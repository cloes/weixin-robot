let ipc = require('electron').ipcRenderer;
let showButton = document.getElementsByName('show-qr-image');
let QRImage = document.getElementById('qr_code');
let testText = document.getElementById('test_text');
var groupMembers = {};

function sendQRRequest() {
/*
    ipc.send('show-qr-image');
    ipc.once('show-image', ()=>{
        QRImage.src = 'i_love_qr.png';
    });
*/
    
}

function getGroupMembers(){
    ipc.on('sendGroupMembers',(event, groupMembers)=>{
        //console.log("sendGroupMembers222");
        testText.innerHTML = groupMembers;
    });

}

getGroupMembers();
