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
    mqtt.clientMsgHandler(mqttClient, (msg) => {
        //parse the topic and upload to the correct firebase document
        let topicParts = msg.topic.split('/')
        //update firestore with the new data.
        switch (topicParts[2]) {
            case "alarm":
                console.log('adding Alarms data');
                //check for existing active alarms
                db.collection('Alarms').where('room', '==', topicParts[0])
                
                break;
        }
        console.log(msg);
    })

}).catch((err) => {
    console.log(err);
});

