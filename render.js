let ipc = require('electron').ipcRenderer;
let showButton = document.getElementsByName('show-qr-image');
let QRImage = document.getElementById('qr_code');
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
    ipc.once('sendGroupMembers',()=>{
        
    });

}
