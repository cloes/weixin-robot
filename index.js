const electron = require('electron');

const app = electron.app;

const BrowserWindow = electron.BrowserWindow;

const https = require('https');

let mainWindow;

function createWindow() {

    mainWindow = new BrowserWindow({width:800,height:600});

    mainWindow.loadURL(`file://${__dirname}/index.html`);

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
    return output.substring(0,output.length - 1);
}

function getUuid() {
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
        console.log(`STATUS: ${res.statusCode}`);
        //console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
        console.log('headers: ', res.headers);
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          console.log(`BODY: ${chunk}`);
          var pattern = /window.QRLogin.code = (\d+); window.QRLogin.uuid = "(\S+?)"/;
          pattern.test(chunk);
          var uuid = RegExp.$2;
          wait4login(uuid);
        });
        res.on('end', () => {
          console.log('No more data in response.');
        })
    });
    req.end();
}

function createQRimage(){
    var qr = require('qr-image');
    var qr_png = qr.image('I love QR!', { type: 'png' });
    qr_png.pipe(require('fs').createWriteStream('i_love_qr.png'));
}

function wait4login(uuid){
    //var LOGIN_TEMPLATE = 'https://login.weixin.qq.com/cgi-bin/mmwebwx-bin/login?tip=%s&uuid=%s&_=%s';
    var login_url = 'login.weixin.qq.com';
    var tip = 1;
    var try_later_secs = 1;
    var MAX_RETRY_TIMES = 10;
    var code = 0;

    var retry_time = MAX_RETRY_TIMES;

    var params = {
      'tip': tip,
      'uuid': uuid,
      '_': Math.round(new Date().getTime()/1000),
    }
    var paramsString = convertArrayToString(params);
    var options = {
        hostname: login_url,
        path: '/cgi-bin/mmwebwx-bin/login' + paramsString,
        method: 'GET',
    };

    var req = https.request(options, (res) => {
        console.log(`STATUS: ${res.statusCode}`);
        //console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
        //console.log('headers: ', res.headers);
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          console.log('2headers: ', res.headers);
          console.log(`2BODY: ${chunk}`);
        });
        res.on('end', () => {
          console.log('2No more data in response.');
        })
    });
    req.end();

}

//app.on('ready',createWindow);

app.on('ready',()=>{
  createWindow();
  getUuid();
  createQRimage();
})

app.on('window-all-closed',function(){
  if (mainWindow === null) {
    createWindow()
  }
});
