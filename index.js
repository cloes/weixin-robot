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
        });
        res.on('end', () => {
          console.log('No more data in response.')
        })
    });
    req.end();
}

//app.on('ready',createWindow);

app.on('ready',()=>{
  createWindow();
  getUuid();
})

app.on('window-all-closed',function(){
  if (mainWindow === null) {
    createWindow()
  }
});
