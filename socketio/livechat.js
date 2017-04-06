/*
    module for handling live chatting.  it exports a function that accepts a socket io object and return
    callback functions for socket io
    
*/


//Managing chat rooms 
function ChatRoomManager(){
    function LiveChatRoom(rid){
        this.rid=rid;
        this.activeUsers={};
        this.addUser = function(uid,channel){
            this.activeUsers[uid]=channel;
        }
        this.removeUser = function(uid){
            delete this.activeUsers[uid];
        }
    };
    var self=this;
    //Store room id and its LiveChatRoom instance
    this.chatrooms={}
    this.joinChatRoom = function(rid, uid, channel){
        if(chatrooms[rid]){
            chatrooms[rid] = new LiveChatRoom(rid);
        }
        chatrooms[rid].addUser(uid,channel);
    }
    this.leaveChatRoom=function(rid,uid){
        chatrooms[rid].removeUser(uid);
        if(Object.keys(chatrooms[rid]).length ==0){
            delete chatrooms[rid];
        }
    }
    this.getAllUsers = function(rid){
        return Object.keys(chatrooms[rid]);
    }
}

var handler = function(io){

}

modules.exports=handler;