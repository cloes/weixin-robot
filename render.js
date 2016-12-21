let ipc = require('electron').ipcRenderer;
let showButton = document.getElementsByName('show-qr-image');
let QRImage = document.getElementById('qr_code');
let testText = document.getElementById('test_text');
var groupMembersObject;
var sourceGroupSelected;
var sourceMemberSelected;
var targetGroupSelected;


function sendQRRequest() {
/*
    ipc.send('show-qr-image');
    ipc.once('show-image', ()=>{
        QRImage.src = 'i_love_qr.png';
    });
*/
    
}

function getSourceGroup(){
    sourceGroupSelected = $('#sourceGroup option:selected').val();
}

function getSourceMember(){
    sourceMemberSelected = $('#sourceMember option:selected').map(function(a, item){return item.value;}).get();
}

function getTargetGroup(){
    targetGroupSelected = $('#targetGroup option:selected').map(function(a, item){return item.value;}).get();
}

//点击确定后向后端发送转发的设置信息
function sendSyncOption(){
    getSourceGroup();
    getSourceMember();
    getTargetGroup();
    var syncOption = {
        'sourceGroupSelected':sourceGroupSelected,
        'sourceMemberSelected':sourceMemberSelected,
        'targetGroupSelected':targetGroupSelected,
    };
    ipc.send('sendSyncOption', JSON.stringify(syncOption));
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
    $('#sourceMember').multiselect('rebuild');
}

function getGroupMembers(){
    ipc.on('sendGroupMembers',(event, groupMembers)=>{
        groupMembersObject = JSON.parse(groupMembers);
        var sourceGroup = document.getElementById('sourceGroup');
        var targetGroup = document.getElementById('targetGroup');
        var i = 1;
        for(p in groupMembersObject){
            sourceGroup.options[i] = new Option(groupMembersObject[p]['NickName'], p);
            targetGroup.options[i-1] = new Option(groupMembersObject[p]['NickName'], p);
            i++;
        }
        $('#targetGroup').multiselect('rebuild');
    });
}

getGroupMembers();
