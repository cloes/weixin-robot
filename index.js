const electron = require('electron');

const app = electron.app;

const BrowserWindow = electron.BrowserWindow;

const https = require('https');

const http = require('http');

const url = require('url');

const xml2js = require('xml2js');

let mainWindow;

let ipc = require('electron').ipcMain;

var retry_time = 3;

var uuid;

var tip = 1;

var redirect_uri;

var skey,wxsid,wxuin,pass_ticket;


function createWindow() {
    mainWindow = new BrowserWindow({width:800,height:600});

    mainWindow.loadURL(`file://${__dirname}/index.html`);

    ipc.on('show-qr-image',(event, data)=>{
        console.log("get message from client");
        event.sender.send('show-image');
    })

    mainWindow.webContents.openDevTools();
    mainWindow.on('closed',function(){
        mainWindow = null;
    });
}


function convertArrayToString(params) {
    var output = '?';
    for (var key in params) {
        output += key + '=' + params[key] + '&';
    }
    return output.substring(0, output.length - 1);
}

function getUuid() {
    return new Promise((resolve, reject) => {
            //var url = 'https://login.weixin.qq.com/jslogin';
            var url = 'login.weixin.qq.com';
            var timestamp = new Date().getTime();
            var random = timestamp + Math.floor(Math.random() * 1000);

            var params = {
              'appid': 'wx782c26e4c19acffb',
              'fun': 'new',
              'lang': 'zh_CN',
              '_': random,
            }
            var paramsString = convertArrayToString(params);
            var options = {
                hostname: url,
                path: '/jslogin' + paramsString,
                method: 'GET',
            };

            var req = https.request(options, (res) => {
                //console.log(`STATUS: ${res.statusCode}`);
                //console.log('headers: ', res.headers);
                res.setEncoding('utf8');
                res.on('data', (chunk) => {
                  var pattern = /window.QRLogin.code = (\d+); window.QRLogin.uuid = "(\S+?)"/;
                  pattern.test(chunk);
                  uuid = RegExp.$2;
                  console.log(`origin uuid:${uuid}`);
                  resolve();
                });

                res.on('end', () => {
                  //console.log('No more data in response.');
                })
            });

            req.end();
        });
}

function createQRimage(){
    var uuidString = 'https://login.weixin.qq.com/l/' + uuid;
    var qr = require('qr-image');
    var qr_png = qr.image(uuidString, { type: 'png' });
    qr_png.pipe(require('fs').createWriteStream('login.png'));
}


function doRequestPromise(){
    return new Promise(function(resolve, reject){
        function doRequest(){
            console.log(`try_time:${retry_time}`);
            var login_url = 'login.weixin.qq.com';
            var code;
            var params = {
                'tip': tip,
                'uuid': uuid,
                '_': Math.round(new Date().getTime()/1000),
            };

            var paramsString = convertArrayToString(params);
            var options = {
                rejectUnauthorized:false,
                agent:false,
                hostname: login_url,
                path: '/cgi-bin/mmwebwx-bin/login' + paramsString,
                port: 443,
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (X11; Linux i686; U;) Gecko/20070322 Kazehakase/0.4.5'
                }
            };

            var req = https.request(options, (res) => {
                res.setEncoding('utf8');
                res.on('data', (chunk) => {
                    var pattern_for_code = /window.code=(\d+);/;
                    pattern_for_code.test(chunk);
                    code = RegExp.$1;

                    var pattern_for_redirect_url = /window.redirect_uri="(\S+?)";/;
                    pattern_for_redirect_url.test(chunk);
                    redirect_uri = RegExp.$1;
                });

                res.on('end', () => {
                    console.log(code);
                    if(code == 201){//scand
                        tip = 0;
                        console.log("scand");
                        doRequest();
                    }else if(code == 200){//success
                        console.log("success");
                        resolve();
                    }else if(code == 408 && retry_time > 0){//timeout
                        retry_time--;
                        setTimeout(doRequest,1000);
                    }else{
                        reject(408);
                    }
                })
            });

            req.on('error',(err)=>{
                console.log(err);
            })
            
            req.end();
        }
        doRequest();
    });
}


function login(){
    var redirect_uri_object = url.parse(redirect_uri);
    console.log("login");
    console.log(redirect_uri);
    var options = {
        hostname: redirect_uri_object.hostname,
        path: redirect_uri_object.path,
        method: 'GET',
    }

    var req = https.request(options, (res) => {
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
            parser = new xml2js.Parser();
            parser.parseString(chunk, function (err, result) {
                skey = result.error.skey;
                wxsid = result.error.wxsid;
                wxuin = result.error.wxuin;
                pass_ticket = result.error.pass_ticket;
            });
        });

        res.on('end', () => {});
    });

    req.end();
}

function getSyncKey(){
    var pattern_for_hostname = /https:\/\/(.*)\/cgi-bin/;
    pattern_for_hostname.test(redirect_uri);
    var hostname = RegExp.$1;
    console.log(hostname);

}

app.on('ready',()=>{
  var promise = getUuid();

  promise.then(createQRimage).then(createWindow).then(doRequestPromise).then(login,(reject_code)=>{
      console.log(`reject_code is:${reject_code}`);
  }).then(getSyncKey);

})

app.on('window-all-closed',function(){
  if (mainWindow === null) {
    createWindow()
  }
});