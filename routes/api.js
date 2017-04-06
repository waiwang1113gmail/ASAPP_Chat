var express = require('express');
var config = require('../configs/config');
var router = express.Router(); 
var responses = require('../modules/response');
var entities = require('../modules/entities');
var db = require('../db/db');


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

//////////////////////////////////////////////////////////////////////////////////////
//User API
//////////////////////////////////////////////////////////////////////////////////////

//Create new user
router.post('/login',function(req,res,next){
    var newUser = req.body;
    if(!newUser.name || newUser.name.length==0){
        next(new BadRequest("Bad Request: user must have a name."));
    }else{
        db.findUser(newUser.name,function(error,user){
            if(error){
                next(new ServerError(error));
            }
            if(user){
                res.cookie("uid",user._id,cookieProperties);
                res.json(user);
            }else{
                newUser = new entities.User(newUser.name);
                db.addUser(newUser,function(error,user){
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
    db.getUser(req.uid,SimpleMongoDbCallback(res,next));
});
//Fectch user data for given id
router.get('/user/:id',function(req,res,next){
    db.getUser(req.params.id,SimpleMongoDbCallback(res,next)); 
});

//////////////////////////////////////////////////////////////////////////////////////
//Chat Room API
//////////////////////////////////////////////////////////////////////////////////////
router.get('/room/:id',function(req,res,next){
    db.getChatRoom(req.params.id,SimpleMongoDbCallback(res,next));  
});
router.get('/rooms',function(req,res,next){
    db.getChatRooms(SimpleMongoDbCallback(res,next)); 
});

router.post('/room/create',function(req,res,next){
    var room = req.body;
    var uid= req.uid;
    if(!room.name || room.name.length==0){
        next(new BadRequest("Bad Request: chat room must have a name."));
    }else{
        db.createChatRoom(new entities.ChatRoom(room.name,uid),function(error,newRoom){
            if(error){
                next(new ServerError(error));
            }else{
                db.joinRoom(room._id.toString(),uid,function(error,result){
                    if(error){
                        next(new ServerError(error));
                    }else{
                        res.json(newRoom);
                    }
                }); 
            }
        });
    }
});

router.post('/room/join',function(req,res,next){
    var joinRequest = req.body; 
    if(!joinRequest.room || joinRequest.room.length===0){
        db.joinRoom(joinRequest.room,req.uid,function(error,result){
            if(error){
                next(new ServerError(error));
            }else{
                res.json(result);
            }
        }); 
    };
  
});


//////////////////////////////////////////////////////////////////////////////////////
//Messages APi
//////////////////////////////////////////////////////////////////////////////////////

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

