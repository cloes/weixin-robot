const electron = require('electron');

const app = electron.app;

const BrowserWindow = electron.BrowserWindow;

const https = require('https');

let mainWindow;

let ipc = require('electron').ipcMain;

var retry_time = 3;

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
                  resolve(uuid);
                });

                res.on('end', () => {
                  console.log('No more data in response.');
                })
            });

            req.end();
        });
}

function createQRimage(uuid){
    var uuidString = 'https://login.weixin.qq.com/l/' + uuid;
    var qr = require('qr-image');
    var qr_png = qr.image(uuidString, { type: 'png' });
    qr_png.pipe(require('fs').createWriteStream('login.png'));
    return uuid;
}

function wait4login(uuid){
    var MAX_RETRY_TIMES = 3;
    var retry_time = MAX_RETRY_TIMES;
    var code = 0;
    code = doRequest(uuid,retry_time);
    console.log(`return code is ${code}`);
}

function doRequest(uuid){
    //var LOGIN_TEMPLATE = 'https://login.weixin.qq.com/cgi-bin/mmwebwx-bin/login?tip=%s&uuid=%s&_=%s';
    console.log(`try_time:${retry_time}`);
    var login_url = 'login.weixin.qq.com';
    var tip = 1;
    var try_later_secs = 1;
    var code = 0;

    var params = {
      'tip': tip,
      'uuid': uuid,
      '_': Math.round(new Date().getTime()/1000),
    }
    var paramsString = convertArrayToString(params);
    console.log(paramsString);
    var options = {
        hostname: login_url,
        path: '/cgi-bin/mmwebwx-bin/login' + paramsString,
        method: 'GET',
    };

    var req = https.request(options, (res) => {
        //console.log(`2STATUS: ${res.statusCode}`);
        //console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
        //console.log('headers: ', res.headers);
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          var pattern = /window.code=(\d+);/;
          pattern.test(chunk);
          code = RegExp.$1;
          console.log(`code inside:${code}`);

          if (code == 408) {
              //timeout
              Console.log("---408---");
              if(retry_time > 0){
                  retry_time--;
                  code = doRequest(uuid);
              }else{
                  return false;
              }
          }
          return code;
          //console.log('2headers: ', res.headers);
        });

        res.on('end', () => {
          console.log('2No more data in response.');
        })
    });

    req.on('error',()=>{
        if(retry_time > 0){
            retry_time--;
            console.log("request error");
            return doRequest(uuid);
        }else{
            console.log("timeout");
            return 408;
        }
    })

    req.end();
}

//app.on('ready',createWindow);

app.on('ready',()=>{
  createWindow();

  var promise = getUuid();
  promise.then(createQRimage).then(doRequest);


  //createQRimage(uuid);
  //wait4login(uuid);
})

app.on('window-all-closed',function(){
  if (mainWindow === null) {
    createWindow()
  }
});
