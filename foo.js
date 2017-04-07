function chainedFunctionsCall(){
    console.log("Invoke chained functions calls: "+arguments.length);
    if(arguments.length<2){
        throw new Error("this function takes at least two aguments");
    }

    var funcs = Array.from(arguments);
    var callback = funcs.splice(-1)[0];
    var proxyFunction = (function(){
        var errors=[];
        var results = [];
        var isError=false;
        return function(error,result){
            errors.push(error);
            results.push(result);
            try{console.log(arguments.callee.hello+"dassafas");}catch(err){console.log(err)}
             
            if(error || funcs.length===0){
                isError=true;
                callback(isError,errors,results);
            }else{ 
                funcs.shift()(arguments.callee);
            }
        }

    })();
    funcs.shift()(proxyFunction);
}

function f1(v1,v2,callback){
    callback(null,"f1");
}

function f2(v1,v2,callback){
    callback(null,"f2");
}


chainedFunctionsCall(function(proxyFunction){
    proxyFunction.hello="Hellowrod";
    f1("","",proxyFunction);
},function(proxyFunction){
    console.log(proxyFunction.hello);
    f2("","",proxyFunction);
},function(isError,errors,results){
    console.log(isError);
    console.log(errors);
    console.log(results);
})
