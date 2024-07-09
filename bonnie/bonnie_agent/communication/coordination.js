import { client, friend_name } from "../config.js";
export { handshake, friend_id }

var friend_id = ""

function getMessage(client) {
    return new Promise((resolve, reject) => {
        client.onMsg((id, name, msg, reply) => {
            console.log("msg: ", msg);
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
            console.log("Received message for handshake: ", receivedMsg);
            receivedMSG = receivedMsg
        });

        // if is the first agent read message and send ack
        let splitMSG = receivedMSG.hello.split(" ");
        if(receivedMSG.iam == friend_name && splitMSG[0] == "[HANDSHAKE]" && splitMSG[1] == friend_name && splitMSG[2] == "firstMessage"){
            first_msg = true
            friend_id = receivedMSG.id
            console.log("Friend id: ", friend_id);
            await client.say(friend_id, {
                hello: '[HANDSHAKE] ' + client.name + ' ack',
                iam: client.name,
                id: client.id
            });
        }
        // if is the second agent read message 
        else if ((receivedMSG.iam == friend_name && splitMSG[0] == "[HANDSHAKE]" && splitMSG[1] == friend_name && splitMSG[2] == "ack")){
            first_msg = true
            friend_id = receivedMSG.id
        }
    }

    console.log("Handshake completed");
}



