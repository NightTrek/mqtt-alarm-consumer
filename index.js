#!/usr/bin/env node
const express = require('express')
var admin = require("firebase-admin");

const mqtt = require('./MQTT.js');
const S = require('./alarmController');
const app = express()
const port = 1520;


var serviceAccount = require("./agroFireBaseAdmin.json");


admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://agromation-grow-room-control.firebaseio.com"
});

const db = admin.firestore();

//get a list of devices from firebase




mqtt.createMqttClient().then((mqttClient) => {

    //middleware
    app.use(express.json());

   //get a list of rooms and subscribe to every alarm channel
   db.collection('Rooms').get().then((querySnapshot) => {
       let subscriptionList = [];
    querySnapshot.forEach((item) => {
        if(item.exists){
            subscriptionList.push(`${item.id}/alarms/alarm`)
        }
    });
    console.log(subscriptionList)
    mqtt.createSub(mqttClient, subscriptionList).then((item) => {
        console.log('subscribed to alarms')
        if(item.length !== subscriptionList.length){
            console.log('subscription error')
        }
    }).catch((err) => {
        console.log('error subscribing to alarms')
        console.log(err)
    })

   }).catch((err) => {
       console.log(err);

   })

    //routes

    //api to test if server is up
    app.get('/alarm/ping', (req, res) => {
        res.set('Access-Control-Allow-Methods', '*');
        res.set('Access-Control-Allow-Headers', '*');
        res.send('DMZ-Alarm-ping \n ')
    })


    // Express app initialization.
    app.listen(port, () => {
        console.log(`Example app listening at http://localhost:${port}`)
    })
    //mqtt message handler
    mqtt.clientMsgHandler(mqttClient, async (msg) => {
        //parse the topic and upload to the correct firebase document
        let topicParts = msg.topic.split('/')
        //update firestore with the new data.
        switch (topicParts[2]) {
            case "alarm":
                console.log('adding Alarms data');
                //check for existing active alarms
                let msgAlarms = msg.msg;
                if(msg.msg.length === 0){
                    //handle no active alarms
                }else{
                    //alarms have a defined length
                    try{
                        let activeAlarmSnapshot = await db.collection('Alarms').where('roomID', '==', topicParts[0]).where('active', '==', true).get();
                        let roomData = await db.collection('Rooms').doc(topicParts[0]).get();
                        let roomName;
                        if(roomData.data()){
                            roomName = roomData.data().name
                        }else{
                            roomName = "room ERROR"
                        }
                        let activeAlarms = {};
                        
                        activeAlarmSnapshot.forEach((item) => {
                            if(item.exists){
                                //add each active alarm to an active alarm object
                                activeAlarms[item.data().msg] = {id:item.id, ...item.data()};
                            }
                        });
                        //added ownerID test
                        msgAlarms.forEach((alarm) => {
                            if( !activeAlarms[alarm.msg]){
                                db.collection('Alarms').add({
                                    active:true,
                                    msg:alarm.msg,
                                    val:alarm.val,
                                    ownerID: alarm.ownerID,
                                    type:alarm.type,
                                    roomID:topicParts[0],
                                    room:roomName,
                                    unixTime:alarm.unixTime
                                });
                            }else{
                                if(activeAlarms[alarm.msg].type !== alarm.type){
                                    db.collection('Alarms').add({
                                        active:true,
                                        msg:alarm.msg,
                                        val:alarm.val,
                                        ownerID: alarm.ownerID,
                                        type:alarm.type,
                                        roomID:topicParts[0],
                                        room:roomName,
                                        unixTime:alarm.unixTime
                                    })
                                }
                            }
                        });

                    }catch(err){
                        console.log(err)
                        console.log('error getting active alarms for room')
                    }
                }
                break;
        }
        console.log(msg);
    })

}).catch((err) => {
    console.log(err);
});

