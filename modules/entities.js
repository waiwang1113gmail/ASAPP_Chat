var entities = {};

entities.User = function(name){
    this.name=name;
    this.chatRoomStatus=[];
}

//This entity represents the chat room status for a given user
entities.ChatRoomStatus= function(rid){
    this.rid=rid;
    this.lastUpdate = null;
} 

entities.ChatRoom = function(name,owner){
    this.name=name;
    this.users=[];
    this.owner=owner;
}

entities.Message = function(uid,rid,message){
    this.uid=uid;
    this.rid=rid;
    this.timestamp=new Date();
    this.message = message;
}

module.exports = entities;