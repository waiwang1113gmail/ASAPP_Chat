var object = {};

object.BadRequest=function(message){
    this.message = message;
    this.code=400;
}


object.ServerError=function(message){
    this.message = message;
    this.code=500;
}
object.NoteFoundError=function(message){
    this.message = message;
    this.code=404;
}
object.UnauthenticatedError=function(){
    this.message = "Unauthenticated request";
    this.code=401;
} 
object.UpdateOperationResponse=function(operation){
    this.operation=operation;
}

module.exports=object;