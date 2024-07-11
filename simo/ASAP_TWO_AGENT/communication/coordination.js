import { client, friend_name } from "../config.js";
import { computeBestOption } from "../utils.js"
import { CollaboratorData, MyData } from "../belief/belief.js";

function getMessage(client) {
    return new Promise((resolve, reject) => {
        client.onMsg((id, name, msg, reply) => {
            resolve(msg);
        });
    });
}

async function handshake() {

    // Wait 500ms for synchronization
    await new Promise(resolve => setTimeout(resolve, 500));

    // Send message in broadcast (just the first agent will receive it)
    client.shout({
        hello: '[HANDSHAKE] ' + client.name + ' firstMessage',
        iam: client.name,
        id: client.id
    });

    // Wait for the first message from the other agent
    let first_msg = false
    while (!first_msg){
        
        // wait for the first message and read it
        let receivedMSG = ""
        await getMessage(client).then(receivedMsg => {
            receivedMSG = receivedMsg
        });

        // if is the first agent read message and send ack (SLAVE)
        let splitMSG = receivedMSG.hello.split(" ");
        if(receivedMSG.iam == friend_name && splitMSG[0] == "[HANDSHAKE]" && splitMSG[1] == friend_name && splitMSG[2] == "firstMessage"){
            first_msg = true
            // SLAVE-SIDE
            CollaboratorData.id = receivedMSG.id;
            CollaboratorData.name = receivedMSG.name;
            MyData.name = client.name;
            MyData.id = client.id;
            MyData.role = "SLAVE";
            CollaboratorData.role = "MASTER";
            await client.say(CollaboratorData.id, {
                hello: '[HANDSHAKE] ' + client.name + ' ack',
                iam: client.name,
                id: client.id
            });
        }
        // if is the second agent read message 
        else if ((receivedMSG.iam == friend_name && splitMSG[0] == "[HANDSHAKE]" && splitMSG[1] == friend_name && splitMSG[2] == "ack")){
            first_msg = true
            // MASTER-SIDE 
            CollaboratorData.id = receivedMSG.id;
            CollaboratorData.name = receivedMSG.name;
            MyData.name = client.name;
            MyData.id = client.id;
            MyData.role = "MASTER";
            CollaboratorData.role = "SLAVE";
        }
    }
    return true
}


// SLAVE manda options e attende un ordine dal master
async function slaveStateMessage(){

    // MyData.printParcels();
    let reply = await client.ask(CollaboratorData.id, {
        hello: "[INFORM]",
        data: MyData,
        time: Date.now()
    });

    MyData.copy(reply);

    return reply;
}



// MASTER riceve options e manda ordine allo slave

function masterRevision() {
    return new Promise((resolve, reject) => {
        client.onMsg((id, name, msg, reply) => {
            try {
                if (msg.data != undefined){
                    CollaboratorData.copy(msg.data);
                }
                if(computeBestOption())
                if (reply) {
                    reply(CollaboratorData);
                }
                resolve(true); // Resolve the promise with the answer
            } catch (error) {
                console.error(error);
                reject(error); // Reject the promise if there's an error
            }
        });
    });
}

export { handshake, slaveStateMessage, masterRevision };
