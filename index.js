const electron = require('electron');

const app = electron.app;

const BrowserWindow = electron.BrowserWindow;

const https = require('https');

const http = require('http');

let mainWindow;

let ipc = require('electron').ipcMain;

var retry_time = 3;

var uuid;

var tip = 1;

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
    //return uuid;
}



function doRequest(){
    return new Promise(function(resolve,reject){
        //var LOGIN_TEMPLATE = 'https://login.weixin.qq.com/cgi-bin/mmwebwx-bin/login?tip=%s&uuid=%s&_=%s';
        console.log(`try_time:${retry_time}`);
        var login_url = 'login.weixin.qq.com';
        var code;
        var params = {
            'tip': tip,
            'uuid': uuid,
            '_': Math.round(new Date().getTime()/1000),
        }        

        var paramsString = convertArrayToString(params);
        var options = {
            rejectUnauthorized:false,
            agent:false,
            //secureProtocol:'SSLv3_method',
            hostname: login_url,
            path: '/cgi-bin/mmwebwx-bin/login' + paramsString,
            port: 443,
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (X11; Linux i686; U;) Gecko/20070322 Kazehakase/0.4.5'
            }
        };
        console.log("https://login.weixin.qq.com" + options.path);

        var req = https.request(options, (res) => {
            res.setEncoding('utf8');
            res.on('data', (chunk) => {
                var pattern = /window.code=(\d+);/;
                pattern.test(chunk);
                code = RegExp.$1;
                console.log(`code inside:${code}`);     
            });

            res.on('end', () => {
                console.log(code);
                if(code == 201){//scand
                    tip = 0;
                    console.log("scand");
                    doRequest();
                }else if(code == 200){//success
                    resolve(200);
                }else if(code == 408 && retry_time > 0){//timeout
                    //req.abort();
                    retry_time--;
                    //res.resume();
                    setTimeout(doRequest,1500);
                }else{
                    reject(408);
                }
                //console.log('2No more data in response.');
            })
        });

        /*
        req.on('socket',(socket)=>{
            socket.emit('agentRemove');
        });
        */

        req.on('error',(err)=>{
            console.log(err);
            if(retry_time > 0){
                retry_time--;
                console.log("request error",uuid);
                var code = doRequest(uuid);
                resolve(code);
            }else{
                console.log("timeout");
                reject(407);
            }
        })
        
        req.end();
        
    });
}

app.on('ready',()=>{
  var promise = getUuid();

  promise.then(createQRimage).then(createWindow).then(doRequest).then((tmp_code)=>{
      console.log(tmp_code);
  },(error_code)=>{
      console.log(error_code);
  });

})

app.on('window-all-closed',function(){
  if (mainWindow === null) {
    createWindow()
  }
});
