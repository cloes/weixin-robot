let ipc = require('electron').ipcRenderer;
let showButton = document.getElementsByName('show-qr-image');
let QRImage = document.getElementById('qr_code');
let testText = document.getElementById('test_text');
var groupMembersObject;

function sendQRRequest() {
/*
    ipc.send('show-qr-image');
    ipc.once('show-image', ()=>{
        QRImage.src = 'i_love_qr.png';
    });
*/
    
}

function selectSourceMember(obj){
    var sourceMember = document.getElementById('sourceMember');
    var memberList = groupMembersObject[obj.value]['MemberList'];
    var i = 0;
    for(p in memberList){
        if(memberList[p]['DisplayName']){
            sourceMember.options[i] = new Option(memberList[p]['DisplayName'], memberList[p]['UserName']);
        }else{
            sourceMember.options[i] = new Option(memberList[p]['NickName'], memberList[p]['UserName']);
        }
        i++;
    }
}

function getGroupMembers(){
    ipc.on('sendGroupMembers',(event, groupMembers)=>{
        groupMembersObject = JSON.parse(groupMembers);
        var sourceGroup = document.getElementById('sourceGroup');
        var i = 0;
        for(p in groupMembersObject){
            sourceGroup.options[i] = new Option(groupMembersObject[p]['NickName'], p);
            i++;
        }
        //testText.innerHTML = groupMembers;
    });
}

getGroupMembers();
