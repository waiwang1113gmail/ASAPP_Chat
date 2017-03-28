# ASAPP Chat 

Basic chat service implemented by using [MEAN stack](http://mean.io/). 

## Prerequisites
Make sure you have installed all of the following prerequisites on your development machine:
* Node.js
* bower 
* mocha - (optional)
## Installation
```bash
$ npm install
```

## Usage
```bash
//To start the server
$ node server
```
Open http://localhost:9000/ in your browser to start the chat service
```bash
//Run test
$ mocha
```
### RESTful API
Following endpoints are available to interact with the chat service
* POST /api/login - must be called before access other endpoints
 	* data {name:"username here"}
* GET /api/user - return current login user
* GET /api/user/{id} - user data for given id
* POST /api/room/create - create chat room using current login user
	* data {name:"new room name"} 
* GET /api/rooms - return all rooms
* GET /api/room/{id} - room data for given id
* POST /api/room/{id}/newmessage - send a message to given chat room
	* data {message:"message content here"} 	
* GET /api/room/{id}/messages - get messages from all given room id, the current user must be a member of the chat room, and update lastUpdate value for given room
* GET /api/room/{id}/messagesSinceLastupdate - get messages from all given room id since lastUpdate, the current user must be a member of the chat room, and update lastUpdate value for given room

## Credits
* [Bootstrap](http://getbootstrap.com/)
* [MEAN stack](http://mean.io/)
* [Chat template](http://bootsnipp.com/snippets/ZlkBn)
## Troubleshooting

* the chat service uses [mLab](https://mlab.com) mongodb service, if you cannot connect to it, change config.js in config directory to point to your own mongodb server