var db = require('../db/db');

/*
    module for handling live chatting.  it exports a function that accepts a socket io object and return
    callback functions for socket io
    
*/


function ChatRoomMessage(rid,msg){
    this.rid=rid;
    this.data = msg;
}

var handler = function(io){
    io.on('connection',function(socket){
        socket.charrooms={};
        socket.on('disconnect',function(){
            console.log("disconnect from webseocket");
            console.log(socket.charrooms);
            if(socket.charrooms){
                for(var roomId in socket.charrooms){
                    broadcastLeaveMessage(roomId,socket.uid);
                }
            }
        });
        socket.on('join',function(request){
            var roomId = request.rid;
            var uid = request.uid;
            var uname = request.uname;
            if(!roomId || !uid){
                console.log("invalid join request, missing room id or user id");
                emitErrorMessage("Failed to join chat room");
            }else if(socket.charrooms[roomId]){
                console.log("already joined");
            }
            else{
                socket.charrooms[roomId]=true; 
                socket.join("room"+roomId);
                console.log(socket.charrooms);
                socket.uid=uid;
                console.log(uname+ " has joined the chat room: "+roomId);
                broadcastJoinMessage(roomId,uid)
                console.log("send clients in chat room list  back");
                //Send the list of clients in the chat room
                var clientIdList =[];
                for (var socketId in io.nsps['/'].adapter.rooms["room"+roomId].sockets) {
                    console.log("socket in room: "+ socketId);
                    if(io.sockets.connected[socketId])
                        clientIdList.push(io.sockets.connected[socketId].uid);
                }
                console.log("Client list: "+clientIdList);
                socket.emit("clientlist",new ChatRoomMessage(roomId,clientIdList))
            }
        });

        socket.on('message',function(request){

            console.log("new message request "+request);
            var roomId = request.rid;
            var message = request.message; 
            if(!roomId || !message ){
                console.log("invalid message request, missing room id or msg");
                emitErrorMessage("Failed to send a message");
            }else if(!socket.charrooms[roomId]){
                console.log("You need to join the chat room first");
                emitErrorMessage("You need to join the chat room first");
            }else{
                db.newMessage(socket.uid,roomId,message,function(error,msg){
                    if(error)
                        console.log("failed to save message");
                    else
                        console.log("inserted new message successfully");
                    io.sockets.to("room"+roomId).emit('message', 
                        new ChatRoomMessage(roomId,msg));  
                });
            }
        });
        socket.on('leave',function(request){
            var roomId = request.rid; 
            if(!roomId){
                console.log("invalid leave request, missing room id");
                emitErrorMessage("Failed to leave room");
            }else{
                socket.leave(roomId);
                delete socket.rooms[roomId];
                broadcastLeaveMessage(roomId,socket.uid);
            }
        });
        //Listen for modify last update event, and it does not return 
        //any response. 
        socket.on('lastUpdate',function(request){
            var roomId = request.rid; 
            var timestamp = request.timestamp; 
            var uid = request.uid; 
            if(roomId && timestamp &&uid){
                console.log("update last update timestamp");
                db.updateLastUpdate(uid,rid,timestamp,function(error){
                    if(error)
                        console.log("failed to update last update timestamp");
                    else
                        console.log("updated last update timestamp successfully");
                })
            } 
        });
        function broadcastJoinMessage(roomId,uid){
            console.log("Broadcasting join message "+roomId);
            //Broadcast that a new client has joined the chat room
            io.in("room"+roomId).emit('newclient', 
                new ChatRoomMessage(roomId,uid));
        }
        function broadcastLeaveMessage(roomId,uid){
            console.log("Broadcasting leave message "+roomId);
            //Broadcast that a new client has joined the chat room
            io.sockets.in("room"+roomId).emit('clientleave', 
                new ChatRoomMessage(roomId,uid));
        }

        var emitErrorMessage= function(msg){
            socket.emit("chaterror",msg);
        }
    });
    
}

module.exports=handler;