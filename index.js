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

let deviceSubs = {
    AgroOffice1: {
        live: {},
        dataHistory: {}
    },
}
let GlobalTopicSubscriptionList = {
    ///"AgroOffice1/data/Live": 1241516
}

let prevLiveData = {};
let prev30minHistory = {};

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
                let alarmRef = db.collection('Rooms').doc(topicParts[0]).collection('Alarms').doc();
                S.AddAlarms(alarmRef, {unixTime: msg.msg[0].unixTime, activeAlarms: msg.msg});
                break;
        }

        if (GlobalTopicSubscriptionList[msg.topic] < Math.floor(Date.now() / 1000)) {
            console.log('removing expired sub')
            mqtt.removeSubs(mqttClient, msg.topic)
        }
        console.log(msg);
    })

}).catch((err) => {
    console.log(err);
});

