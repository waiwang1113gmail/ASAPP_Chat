var config = require('../configs/config');
var mongojs = require('mongojs');
var db = mongojs(config.db
            ,['message','chat_room','user']); 
var entities = require('../modules/entities');
var obj={};
var ChatRoomStatus = entities.ChatRoomStatus;


//////////////////////////////////////////////////////////////////////////////////////
//User API
//////////////////////////////////////////////////////////////////////////////////////
obj.addUser = function(newUser,callback){
     db.user.insert(newUser,callback);
}
obj.findUser=function(name,callback){
    db.user.findOne({
        "name": name
    },callback);
}
obj.getUser=function(uid,callback){
    try{
        var oid=mongojs.ObjectId(uid);
        db.user.findOne({
            _id:oid
        },callback);
    }catch(err){
        callback("bad id passed");
    }
}
obj.addChatRoom = function(uid, rid, callback){
    try{
        var uid_obj = mongojs.ObjectId(uid);
        db.user.update({
            _id: uid_obj
        },{
            $push: {
                chatRoomStatus: new entities.ChatRoomStatus(rid)
            }
        },callback);
    }catch(error){
        console.log("ERROR: "+ error );
        callback("Invalid id passed")
    }
    
}
obj.updateLastUpdate=function(uid,rid,timestamp,callback){
    try{
        var oid=mongojs.ObjectId(uid);
        db.user.update({
            "chatRoomStatus.rid":rid,
            _id: oid
        },{$set:{
            "chatRoomStatus.$.lastUpdate":timestamp
        }},function(error, response){   
            if(error){
                console.log("ERROR: "+ error );
                callback("Database error ");
            }else if(!response.nModified || response.nModified==0){
                callback("the user has to joined the chat room first");
            }else{
                callback(null,{});
            }
        });
    }catch(err){
        callback("bad id passed");
    }
}
//////////////////////////////////////////////////////////////////////////////////////
//Chat Room API
//////////////////////////////////////////////////////////////////////////////////////
obj.getChatRoom=function(rid,callback){
    try{
        var oid=mongojs.ObjectId(rid);
        db.chat_room.findOne({
            _id:oid
        },callback);
    }catch(err){
        callback("bad id passed");
    }
} 
obj.getChatRooms=function(callback){
    db.chat_room.findOne({},callback);
}
obj.createChatRoom=function(chatRoom,callback){
    db.chat_room.save(chatRoom,callback);
}
obj.joinChatRoom = function(rid,uid,callback){
    try{
        var rid_obj = mongojs.ObjectId(rid);
        db.chat_room.update({
            _id: rid_obj
        },{
            $push: {
                users: uid
            }
        },function(error,updatedChatRoom){
            if(error){
                console.log("ERROR: "+ error );
                callback("Database error ");
            }else if(userUpdatedResult.nMatched==0){
                callback("no chat room found");
            }else{
                callback(null,{});
            }
        });
    }catch(err){
        console.log("ERROR: "+ err );
        callback("bad id passed");
    }
}


//////////////////////////////////////////////////////////////////////////////////////
//Messages APi
//////////////////////////////////////////////////////////////////////////////////////

obj.retrieveMessages =function(rid,uid,timstamp,callback){
    //Verify the request is valid: the current user is in the chat room
    //update lastUpdate value in user document
    var selector = {rid:rid}; 
    if(timestamp){
        //contains a timestamp, only return messages created after the given timestamp
        selector.timestamp={$gt:new Date(timestamp)};
    }
    db.message.find(selector,callback);

}
obj.newMessage = function(uid,rid,message,callback){
    db.message.insert(new entities.Message(uid,rid,message),callback);
};

module.exports = obj;