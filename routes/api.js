var express = require('express');
var config = require('../configs/config');
var router = express.Router();
var mongojs = require('mongojs');
var db = mongojs(config.db
            ,['message','chat_room','user']);
var responses = require('../modules/response');
var entities = require('../modules/entities');

var BadRequest = responses.BadRequest; 
var ServerError = responses.ServerError; 
var NoteFoundError = responses.NoteFoundError;
var UpdateOperationResponse = responses.UpdateOperationResponse;



var cookieProperties = { 
    "httpOnly":true,
    expires: new Date(Date.now() + config.sessionLength)
};
//Create a mongodb callback function that returns data from mongodb
function SimpleMongoDbCallback(res,next){
    return function(error,obj){
        if(error){
            next(new ServerError(error));
        }else if(!obj){
            next(new NoteFoundError(obj));
        }
        else{ 
            res.json(obj);
        }
    }
};

//Return operator for given conditions and values
function addOperator(operation){
    return {
        $push: operation
    }
}
function removeOperator(operation){
    return {
        $pull: operation
    }
}
//Helper function to join or leave the chat room
function joinOrLeaveChatRoom(chatRoom,uid,res,next,join,callback){
    if(!chatRoom || chatRoom.length==0){
        next(new BadRequest("Bad Request: must contains a chat room id"));
    }else{
        var updateRequest = {}; 
        var operator = join? 
            addOperator({
                chatRoomStatus: new entities.ChatRoomStatus(chatRoom)
            }):
            removeOperator({
                chatRoomStatus:{
                    rid: chatRoom
                }
            });
        db.user.update({
                _id: mongojs.ObjectId(uid)
            },
            operator,
            function(error,userUpdatedResult){
                if(error){
                    next(new ServerError(error));
                }else if(userUpdatedResult.nMatched==0){
                    next(new BadRequest("no chat room found"));
                }
                else{
                    var operator = join? 
                        addOperator({
                            users: uid
                        }):
                        removeOperator({
                            users: uid
                        });
                    db.chat_room.update({
                        _id: mongojs.ObjectId(chatRoom)
                    },operator,function(error,chatRoomUpdatedResult){
                        if(error){
                            next(new ServerError(error));
                        }else{
                            if(callback) 
                                callback();
                            else
                                res.json(new UpdateOperationResponse(join? "join":"leave"));
                        }
                    });
                }
        });
    }
}
//function to handle request of single data entry
function retrieveSingleEntry(collections,res,next,_id){
    try{
        var oid=mongojs.ObjectId(_id);
        collections.findOne({_id:oid},SimpleMongoDbCallback(res,next));
    }catch(err){
        next(new BadRequest("Bad id passed"));
    }
} 
//////////////////////////////////////////////////////////////////////////////////////
//User API
//////////////////////////////////////////////////////////////////////////////////////
//Create new user
router.post('/login',function(req,res,next){
    var newUser = req.body;
    if(!newUser.name || newUser.name.length==0){
        next(new BadRequest("Bad Request: user must have a name."));
    }else{
        db.user.findOne({"name":newUser.name},function(error,user){
            if(error){
                next(new ServerError(error));
            }
            if(user){
                res.cookie("uid",user._id,cookieProperties);
                res.json(user);
            }else{
                newUser = new entities.User(newUser.name);
                db.user.insert(newUser,function(error,user){
                    if(error){
                        next(new ServerError(error));
                    }else{
                        res.cookie("uid",user._id,cookieProperties);
                        res.json(user);   
                    }
                });
            }
        }); 
    }
});

//Fectch current user data
router.get('/user',function(req,res,next){
    retrieveSingleEntry(db.user,res,next,req.uid); 
});
//Fectch current user data
router.get('/user/:id',function(req,res,next){
    retrieveSingleEntry(db.user,res,next,req.params.id);  
});

router.get('/user/unread/messages',function(req,res,next){
    db.user.findOne({
        _id:mongojs.ObjectId(req.uid)
    },function(error,userData){
        if(error){ 
            next( new ServerError(error));
        }else{  
            var results=[];
            var counter =userData.chatRoomStatus.length; 
            userData.chatRoomStatus.forEach(function(s){ 
                console.log(s.rid);
                var pipeline = [{
                    $match:{
                        rid:s.rid,
                        timestamp:{
                            $gt: (s.lastUpdate?s.lastUpdate:new Date(0))
                        }
                    }
                },{
                    $group:{
                        _id:"$rid",
                        count:{
                            $sum:1
                        }
                    }
                }];
                db.message.aggregate(pipeline,function(error,response){
                    console.log(response)
                    if(error){
                        next(new ServerError(error));
                    }else{
                        results.push(response[0]);
                        if(--counter==0) res.json(results);
                    }
                })
            });
        }
    });
});
//////////////////////////////////////////////////////////////////////////////////////
//Chat Room API
//////////////////////////////////////////////////////////////////////////////////////
router.get('/room/:id',function(req,res,next){
    retrieveSingleEntry(db.chat_room,res,next,req.params.id);  
});
router.get('/rooms',function(req,res,next){
    db.chat_room.find({},SimpleMongoDbCallback(res,next));
});

router.post('/room/create',function(req,res,next){
    var room = req.body;
    var uid= req.uid;
    if(!room.name || room.name.length==0){
        next(new BadRequest("Bad Request: chat room must have a name."));
    }else{
        db.chat_room.save(new entities.ChatRoom(room.name,uid),function(error,room){
            if(error){
                next(new ServerError(error));
            }else{
                joinOrLeaveChatRoom(room._id.toString(),uid,res,next,true,function(){
                    db.user.update({
                        _id: mongojs.ObjectId(uid)
                    },{$addToSet : {users: uid}},function(error,result){
                        if(error){
                            next(new ServerError(error));
                        }else{
                            res.json(room);
                        }
                    });
                });
            }
        });
    }
});

router.post('/room/join',function(req,res,next){
    var joinRequest = req.body; 
    joinOrLeaveChatRoom(joinRequest.room,req.uid,res,next,true);
    
});
router.post('/room/leave',function(req,res,next){
    var joinRequest = req.body;
    joinOrLeaveChatRoom(joinRequest.room,req.uid,res,next,false);
});


//////////////////////////////////////////////////////////////////////////////////////
//Messages APi
//////////////////////////////////////////////////////////////////////////////////////
function retrieveMessages(res,next,uid,roomID,timestamp){
    //Verify the request is valid: the current user is in the chat room
    //update lastUpdate value in user document
    var selector = {rid:roomID}; 
    if(timestamp){
        //contains a timestamp, only return messages created after the given timestamp
        selector.timestamp={$gt:new Date(timestamp)};
    }
    db.user.update({
        "chatRoomStatus.rid":roomID,
        _id:mongojs.ObjectId(uid)
    },{$set:{
        "chatRoomStatus.$.lastUpdate":new Date()
    }},function(error, response){   
        if(error){
            next(new ServerError(error));
        }else if(!response.nModified || response.nModified==0){
            next(new BadRequest("the user has to joined the chat room first"));
        }else{
            db.message.find(selector,SimpleMongoDbCallback(res,next));
        }
    });

}




router.post('/room/:id/newmessage',function(req,res,next){
    var messageRequest = req.body;
    if(!messageRequest.message){
        next(new BadRequest("Bad Request: must contains a message"));
    }else{
        db.message.insert(new entities.Message(req.uid,req.params.id,messageRequest.message),SimpleMongoDbCallback(res));
    }
});

router.get('/room/:id/messages',function(req,res,next){
    var roomID=req.params.id;
    retrieveMessages(res,next,req.uid,roomID);
});

router.get('/room/:id/messagesSinceLastupdate',function(req,res,next){
    var roomID=req.params.id;
    db.user.find({
        _id:mongojs.ObjectId(req.uid)
    },{"chatRoomStatus":{$elemMatch: {rid:roomID}}},function(error,userData){
        if(error){
            next( new ServerError(error));
        }if(!userData[0]){
            next( new ServerError(""));
        }else{ 
            retrieveMessages(res,next,req.uid,roomID,userData[0].chatRoomStatus[0].lastUpdate);
        }
    });
});

module.exports = router;

