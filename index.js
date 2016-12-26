const electron = require('electron');

const fs = require('fs');

const app = electron.app;

const BrowserWindow = electron.BrowserWindow;

const https = require('https');

const http = require('http');

const url = require('url');

const xml2js = require('xml2js');

const querystring = require('querystring');

let mainWindow;

let ipc = require('electron').ipcMain;

var retry_time = 3;

var uuid;

var tip = 1;

var redirect_uri;

var skey,wxsid,wxuin,pass_ticket;

var device_id;

var syncKey = "";

var baseParams;

var myAccount;

var redirectUriObject;

var statusNotifyResult;

var groupList = new Array();

var groupMembers = {}

var encryChatRoomId = {};

var host = ["webpush", "webpush2"];

var cookies = "";

var SyncKeyObj;

var newSyncKey = "";

var groups;

var syncFlag = false;

var syncOption;

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
                    redirectUriObject = url.parse(redirect_uri);
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


function loginPromise(){
    return new Promise(function(resolve, reject){       
        var options = {
            hostname: redirectUriObject.hostname,
            path: redirectUriObject.path,
            method: 'GET',
        };

        var req = https.request(options, (res) => {
            res.setEncoding('utf8');
            res.on('data', (chunk) => {
                var loginCookies = res.headers['set-cookie'];
                loginCookies.forEach((element)=>{
                    var pattern = /^(\w+)=([a-z0-9A-Z_\+=/]+);/;
                    pattern.test(element);
                    var key = RegExp.$1;
                    var value = RegExp.$2;
                    cookies += key + "=" + value + "; ";
                });
                cookies = cookies.substr(0, cookies.length - 2);

                parser = new xml2js.Parser();
                parser.parseString(chunk, function (err, result) {
                    skey = result.error.skey[0];
                    wxsid = result.error.wxsid[0];
                    wxuin = result.error.wxuin[0];
                    pass_ticket = result.error.pass_ticket[0];

                    device_id = Math.floor(Math.random() * 1000000000000000);
                    baseParams = {
                        "Uin":wxuin,
                        "Sid":wxsid,
                        "Skey":skey,
                        "DeviceID":device_id
                    };
                });
            });

            res.on('end', () => {
                resolve();
            });
        });

        req.end();
    });
}


function getSyncKey(){
    return new Promise(function(resolve, reject){
        var res_message = "";
        var postData = JSON.stringify({
            "BaseRequest":baseParams
        });
        var timestamp = new Date().getTime();
        timestamp = timestamp.toString().substr(0,10);

        var options = {
            //rejectUnauthorized:true,
            agent:false,
            hostname: redirectUriObject.hostname,
            path: "/cgi-bin/mmwebwx-bin/webwxinit?r=" + timestamp + "&lang=en_US&pass_ticket=" + pass_ticket,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': postData.length,
            }
        }
        
        var req = https.request(options, (res) => {
            res.setEncoding('utf8');
            res.on('data', (chunk) => {
                res_message += chunk;
            });
            res.on('end', () => {
                //console.log('No more data in response.');
                fs.writeFile('message.txt', res_message, 'utf8', ()=>{
                    console.log("wirte message finish!");
                });
                
                res_obj = JSON.parse(res_message);
                myAccount = res_obj.User;
                SyncKeyObj = res_obj.SyncKey;

                for(var i = 0; i < res_obj.SyncKey.Count; i++){
                    syncKey += res_obj.SyncKey.List[i].Key + "_" + res_obj.SyncKey.List[i].Val + "|";
                }
                syncKey = syncKey.substr(0, syncKey.length - 1);
                if(res_obj.BaseResponse.Ret == 0){
                    console.log("get SyncKey success");
                    resolve();
                }else{
                    console.log("get SyncKey fail");
                    reject();
                }
            });
        });
        req.write(postData);
        req.end();
    });
}


function statusNotify(){
     return new Promise(function(resolve, reject){
        var res_message = "";
        var resObj;
        var timestamp = new Date().getTime();
        var clientMsgId = timestamp.toString().substr(0,10);
        var postData = JSON.stringify({
            "BaseRequest": baseParams,
            "Code": 3,
            "FromUserName": myAccount.UserName,
            "ToUserName": myAccount.UserName,
            "ClientMsgId":clientMsgId,
        });

        var options = {
            //rejectUnauthorized:true,
            agent:false,
            hostname: redirectUriObject.hostname,
            path: "/cgi-bin/mmwebwx-bin/webwxstatusnotify?lang=zh_CN&pass_ticket=" + pass_ticket,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': postData.length,
            }
        };

        var req = https.request(options, (res) => {
            res.setEncoding('utf8');
            res.on('data', (chunk) => {
                res_message += chunk;
            });
            res.on('end', () => {
                //console.log('No more data in statusNotify.');
                resObj = JSON.parse(res_message);
                statusNotifyResult = resObj.BaseResponse.Ret;
                if(statusNotifyResult == 0){
                    resolve();
                }else{
                    reject();
                }
            });
        });

        req.write(postData);
        req.end();
     });
}

function getContact(){
    return new Promise(function(resolve, reject){
        var res_message = "";
        var resObj;
        var timestamp = new Date().getTime();
        var r = timestamp.toString().substr(0,10);
        var memberList;

        var postData = JSON.stringify({});

        var options = {
            //rejectUnauthorized:true,
            agent:false,
            hostname: redirectUriObject.hostname,
            path: "/cgi-bin/mmwebwx-bin/webwxgetcontact?pass_ticket=" + pass_ticket + "&skey=" + skey + "&r=" + r,
            method: 'POST',

            headers: {
                'Content-Type': 'application/json',
                'Content-Length': postData.length,
                'Cookie': cookies,
            }
        };

        var req = https.request(options, (res) => {
            res.setEncoding('utf8');
            res.on('data', (chunk) => {
                res_message += chunk;
            });
            res.on('end', () => {
                //console.log('No more data in response from getContact.');
                fs.writeFile('contact.txt', res_message, 'utf8', ()=>{
                    console.log("wirte contact finish!");
                });
                resObj = JSON.parse(res_message);
                memberList = resObj.MemberList;

                memberList.forEach((element)=>{
                    if(element.UserName.substr(0,2) === "@@"){
                        groupList.push(element);
                        fs.appendFile('groupList.txt', element.UserName + "\r\n", 'utf8', ()=>{
                            console.log("appendFile groupList finish!");
                        });
                    }
                });
                resolve();
            });
        });

        req.write(postData);
        req.end();
    });
    
}

function getAllGroupMembers(){
    return new Promise(function(resolve, reject){
        var resObj;
        var res_message = "";
        var timestamp = new Date().getTime();
        var r = timestamp.toString().substr(0,10);
        var groupNameList = new Array();
        groupList.forEach((element)=>{
            groupNameList.push({
                "UserName": element.UserName,
                "EncryChatRoomId": "",
            });
        });

        var postData = {
            "BaseRequest": baseParams,
            "Count": groupList.length,
            "List":groupNameList,
        };
        postData = JSON.stringify(postData);

        fs.writeFile('getAllGroupMembers_postdata.txt', postData, 'utf8', ()=>{
            console.log("wirte getAllGroupMembers_postdata finish!");
        });

        var options = {
            //rejectUnauthorized:true,
            agent:false,
            hostname: redirectUriObject.hostname,
            path: "/cgi-bin/mmwebwx-bin/webwxbatchgetcontact?type=ex&r=" + r +"&pass_ticket=" + pass_ticket,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': postData.length,
                'Cookie': "wxsid=" + wxsid + "; " + "wxuin=" + wxuin
            }
        };

        var req = https.request(options, (res) => {
            res.setEncoding('utf8');
            res.on('data', (chunk) => {
                res_message += chunk;
            });
            res.on('end', () => {
                //console.log('No more data in response from getAllGroupMembers.');
                
                fs.writeFile('AllGroupMembers.txt', res_message, 'utf8', ()=>{
                    console.log("wirte AllGroupMembers finish!");
                });
                
                resObj = JSON.parse(res_message);
                resObj.ContactList.forEach((element)=>{
                    //groupMembers[element.UserName] = element.MemberList;
                    groupMembers[element.UserName] = element;
                    encryChatRoomId[element.UserName] = element.EncryChatRoomId;
                });

                fs.writeFile('groupMembers.txt', JSON.stringify(groupMembers), 'utf8', ()=>{
                    console.log("wirte groupMembers finish!");
                });

                mainWindow.webContents.send('sendGroupMembers', JSON.stringify(groupMembers));
                console.log("ipc sending finish")

                /*
                fs.writeFile('encryChatRoomId.txt', JSON.stringify(encryChatRoomId), 'utf8', ()=>{
                    console.log("wirte encryChatRoomId finish!");
                });
                */
                resolve();
            });
        });

        req.write(postData);
        req.end();
    });
}


//检测是否有新的消息
function testSync(){
    return new Promise(function(resolve, reject){
        var resMessage = "";
        var timestamp = new Date().getTime();
        var timestamp = timestamp.toString().substr(0,13);

        var timestamp2 = new Date().getTime();
        var timestamp2 = timestamp2.toString().substr(0,13);
        var params = {
            'r': timestamp,
            'sid': wxsid,
            'uin': wxuin,
            'skey': skey,
            'deviceid': device_id,
            'synckey': syncKey,
            '_': timestamp2,
        };

        var paramsString = querystring.stringify(params);
        var options = {
            //rejectUnauthorized:true,
            agent:false,
            path: "/cgi-bin/mmwebwx-bin/synccheck?" + paramsString,
            method: 'GET',
            timeout: 60000,
            headers: {
                'Cookie': cookies,
            }
        };

        var hostIndex = 0;
        function testSyncRequest(){
            options.hostname = host[hostIndex] + ".weixin.qq.com";
            //console.log(options);
            var req = https.request(options, (res) => {
                res.setEncoding('utf8');
                res.on('data', (chunk) => {
                    resMessage = chunk;
                });
                res.on('end', () => {
                    var pattern = /^window.synccheck={retcode:"(\d+)",selector:"(\d+)"/;
                    pattern.test(resMessage);
                    var retcode = RegExp.$1;
                    var selector = RegExp.$2;
                    //console.log(resMessage);
                    if(retcode === "0"){
                        //console.log("sync test success");
                        resolve(selector);
                    }else if(hostIndex < host.length - 1){
                        hostIndex ++;
                        //console.log("sync test fail");
                        testSyncRequest();
                    }else{
                        reject();
                    }
                });
            });
            req.end();
        }
        testSyncRequest();
    });
}

function getMessageType(selector){
    return new Promise(function(resolve, reject){
        switch(selector){
            case "2"://新的消息
                var timestamp = new Date().getTime();
                timestamp = timestamp.toString().substr(0,10);
                var postData = {
                    "BaseRequest": baseParams,
                    "SyncKey": SyncKeyObj,
                    "rr": ~parseInt(timestamp),
                };
                postData = JSON.stringify(postData);

                fs.writeFile('syncPostData.txt', postData, 'utf8', ()=>{
                    //console.log("wirte syncPostData.txt finish!");
                });

                var options = {
                    //rejectUnauthorized:true,
                    agent:false,
                    hostname: redirectUriObject.hostname,
                    path: "/cgi-bin/mmwebwx-bin/webwxsync?sid=" + wxsid + "&skey=" + skey +"&lang=en_US&pass_ticket=" + pass_ticket,
                    method: 'POST',
                    timeout: 60000,
                    headers: {
                        'Content-Type': 'application/json',
                        'Content-Length': postData.length,
                        'Cookie': cookies,
                    }
                }

                var req = https.request(options, (res) => {
                    var resMessage = "";
                    res.setEncoding('utf8');
                    res.on('data', (chunk) => {
                        resMessage += chunk;
                    });
                    res.on('end', () => {
                        fs.writeFile('syncResponseData.txt', resMessage, 'utf8', ()=>{
                            //console.log("wirte syncResponseData finish!");
                        });
                        var responseObj = JSON.parse(resMessage);
                        if(responseObj.BaseResponse.Ret == 0){
                            for(var i = 0; i < responseObj.SyncKey.Count; i++){
                                newSyncKey += responseObj.SyncKey.List[i].Key + "_" + responseObj.SyncKey.List[i].Val + "|";
                            }
                            newSyncKey = newSyncKey.substr(0, newSyncKey.length - 1);
                            syncKey = newSyncKey;
                            SyncKeyObj = responseObj.SyncKey;
                            resolve(responseObj);
                        }else{
                            //reject();
                        }
                    });
                });
                req.write(postData);
                req.end();
                break;
            case "4":
                //通讯录更新
                break;
            case "7":
                //手机上操作过
                break;
            default:
                break;
        }
    }); 
}

//根据用户ID发送消息
function sendMessageById(content,destinationId) {
    var timestamp = new Date().getTime();
    var clientMsgId = timestamp.toString().substr(0,17) + Math.random().toString().substr(-4);
    var postData = JSON.stringify({
        "BaseRequest": baseParams,
        "Msg": {
            "Type": 1,
            "Content":content,
            "FromUserName":myAccount.UserName,
            "ToUserName":destinationId,
            "LocalID": clientMsgId,
            "ClientMsgId": clientMsgId,
        }
    });

    var options = {
        //rejectUnauthorized:true,
        agent:false,
        hostname: redirectUriObject.hostname,
        path: "/cgi-bin/mmwebwx-bin/webwxsendmsg?pass_ticket=" + pass_ticket,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': postData.length,
            'Cookie': cookies,
        }
    };
    
    var req = https.request(options, (res) => {
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
            res_message += chunk;
        });
        res.on('end', () => {
            console.log(`send message result ${res_message}`);

            fs.writeFile('send_message_result.txt', res_message, 'utf8', ()=>{
                console.log("wirte send_message_result.txt finish!");
            });
            //var res_obj = JSON.parse(res_message);
        });
    });
    req.write(postData);
    req.end();
}

function handleMessage(messageObj){
    messageObj.AddMsgList.forEach((message)=>{
        if(syncFlag){
            if(message.FromUserName.substr(0,2) === "@@" && message.MsgType === 1){//群消息
                //console.log(message.FromUserName);
                //console.log(syncOption.sourceGroupSelected);
                fs.appendFile('message_FromUserName_List.txt', message.FromUserName + "\r\n", 'utf8', ()=>{
                    //console.log("appendFile message_FromUserName_List finish!");
                });
                if(message.FromUserName === syncOption.sourceGroupSelected){//消息来源于指定的群
                    console.log("003");
                    fs.appendFile('003.txt', "003" + "\r\n", 'utf8', ()=>{
                        //console.log("appendFile message_FromUserName_List finish!");
                    });
                    if(message.Content.substr(1) === syncOption.sourceMemberSelected){
                        console.log("004");
                        sendMessageById(message.Content, syncOption.targetGroupSelected);
                    }
                }
            }
        }else{
            console.log("syncFlag is false");
        }
    });
}

function getSyncOption(){
    ipc.on('sendSyncOption', (event, arg) => {
        fs.writeFile('SyncOption.txt', arg, 'utf8', ()=>{
            console.log("wirte SyncOption.txt finish!");
        });
        syncOption = JSON.parse(arg);
        syncFlag = true;
    });
}


function processMessage(){
    getSyncOption();

    function getMessage(){
        var testSyncPromise = testSync();
        testSyncPromise.then((selector)=>{
            //console.log("testSync OK");
            //console.log(`selector is ${selector}`);
            return getMessageType(selector);
        },()=>{console.log("testSync not OK");})
        .then((responseObject)=>{
            handleMessage(responseObject);
        })
    }
    //getMessage();
    setInterval(getMessage,1000);

}

app.on('ready',()=>{
  var promise = getUuid();
  promise.then(createQRimage).then(createWindow).then(doRequestPromise).then(loginPromise,(reject_code)=>{
      console.log(`reject_code is:${reject_code}`);
  }).then(getSyncKey)
  .then(statusNotify)
  .then(getContact)
  .then(getAllGroupMembers)
  .then(processMessage);
})

app.on('window-all-closed',function(){
  if (mainWindow === null) {
    createWindow()
  }
});