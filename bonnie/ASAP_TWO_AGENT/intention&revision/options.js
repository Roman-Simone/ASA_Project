import { slaveStateMessage, masterRevision  } from "../communication/coordination.js";
import { MyData, CollaboratorData, parcel_reward_avg } from "../belief/belief.js";
import { calculate_pickup_utility, calculate_putdown_utility, find_random_deliveryFarFromOther, findBestOption } from "./utilsOptions.js";
import { myAgent } from "../index.js";
import { mode } from "../socketConnection.js";

var count = 0;
const THRESH_GO_PUT_DOWN = parcel_reward_avg * 10;                 // when it reach this inmind score, it goes to put down the parcels anyway

async function optionsLoop() {

    // Array to store potential intention options
    
    MyData.options = [];

    // Iterate through available parcels

    for (let parcel of MyData.parcels) {
        if (!parcel.carriedBy && parcel.reward > 3) {

            // Check if parcel is not carried by any agent
            
            let util = calculate_pickup_utility(parcel);                    // if == 0 intrinsic_score < 0 --> non ne vale la pena
            if (util) {
                MyData.options.push(['go_pick_up', parcel.x, parcel.y, parcel.id, util]);
            }
        }
    }
    let putDownInfo = calculate_putdown_utility()
    MyData.options.push(['go_put_down', putDownInfo[0].x, putDownInfo[0].y, "", putDownInfo[1]])
    let u = 2
    let random_delivery = find_random_deliveryFarFromOther();
    MyData.options.push(['go_random_delivery', random_delivery.x, random_delivery.y, "", u]);

    // console.log("[INFO] ", "Options: ", MyData.options, "\n")


    if ( mode == 'TWO' ){
        if (MyData.role == "SLAVE") {
            await slaveStateMessage();

            // MyData.print()
            if(MyData.best_option != undefined){
                console.log(count, " [SLAVE] ", "SLAVE new best_option: ", MyData.best_option, "\n")
            }

            // console.log(count, " [INFO] ", "Slave state message sent and received back")
            count += 1;
        } else if (MyData.role == "MASTER") {
            await masterRevision();

            // CollaboratorData.print()
            if(CollaboratorData.best_option != undefined){
                console.log(count, " [MASTER] ", "MASTER new best_option: ", MyData.best_option, "\n")
            }
            // console.log(count, " [INFO] ", "Master revision done\n")
            count += 1;
        }
    }
    else{
        MyData.best_option = findBestOption(MyData.options)
        // console.log("\nBeliefset: ", MyMap.myBeliefset.toPddlString(), "\n");
    }
    

    console.log("[INFO] ", "Best option: ", MyData.best_option, "\n")

    console.log("inmind score: ", MyData.get_inmind_score(), "\n")

    if(MyData.get_inmind_score() > THRESH_GO_PUT_DOWN){
        console.log("ENTRATO")
        MyData.best_option = ['go_put_down', putDownInfo[0].x, putDownInfo[0].y, "", putDownInfo[1]]
    }

    myAgent.push(MyData.best_option);
}


export { optionsLoop };