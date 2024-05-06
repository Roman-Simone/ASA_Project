import { Agent } from "./agent.js";
import { distanceBFS_notMe, find_nearest, client, parcels, me, map, distanceBFS, find_nearest_delivery } from "./utils.js";

// Define global variables
const beliefset = new Map();

var utilityPutDown = 0;
var decade_frequency = 0;

// here I want to implement f(score, distance) = alpha*score + beta/(distance_parcel + distance_delivery) + min(distance(agent, parcel))

// function calculate_pickup_utility(parcel) {

//     if (!parcel.carriedBy && parcel.reward > 3) {
//         let score = parcel.reward;

//         var intrinsic_score = ALPHA * score - BETA * (distanceBFS(parcel) + distance(parcel, find_nearest(parcel.x, parcel.y, map)[2]));

//         // Consider parcel only if intrinsic score is positive
//         if (intrinsic_score > 0) {
//             // Calculate utility of picking up the parcel
//             var util = intrinsic_score;
//             // Adjust utility based on distance from agents in beliefset
//             if (beliefset.size > 0) {
//                 let min_score_parcel_agent = Number.MAX_VALUE;
//                 for (let a of beliefset.values()) {
//                     let score_parcel_agent = distance(a, parcel);
//                     if (score_parcel_agent < min_score_parcel_agent) {
//                         min_score_parcel_agent = score_parcel_agent;
//                     }
//                 }
//                 util -= min_score_parcel_agent;
//             }

//         } else {
//             return 0;
//         }
//         return util;
//     } else {
//         return 0;
//     }
// }

// function calculate_putdown_utility() {

//     if (myAgent.parcelsInMind.length == 0)
//         return 0;

//     var scoreInMind = 0;
//     for (let p of myAgent.parcelsInMind) {
//         for (const [id, parcel] of parcels.entries()) {
//             if (p === id) {
//                 scoreInMind += parcel.reward;
//             }
//         }
//     }
//     var utility = (GAMMA * scoreInMind - DELTA * (distanceBFS(find_nearest(me.x, me.y, map)[2]))) * MULT;

//     return utility;
// }

// Function to update the configuration of elements
//!CONFIGURATION
// Config received:  {
//     MAP_FILE: 'map_20',
//     PARCELS_GENERATION_INTERVAL: '5s',
//     PARCELS_MAX: '5',
//     MOVEMENT_STEPS: 1,
//     MOVEMENT_DURATION: 500,
//     AGENTS_OBSERVATION_DISTANCE: 5,
//     PARCELS_OBSERVATION_DISTANCE: 5,
//     AGENT_TIMEOUT: 10000,
//     PARCEL_REWARD_AVG: 50,
//     PARCEL_REWARD_VARIANCE: 10,
//     PARCEL_DECADING_INTERVAL: 'infinite',
//     RANDOMLY_MOVING_AGENTS: 2,
//     RANDOM_AGENT_SPEED: '2s',
//     CLOCK: 50
//   }


var movement_duration = 0;
var parcel_decading_interval = 0;
var configElements;
client.onConfig((config) => {
    configElements = config;

    var movement_duration = configElements.MOVEMENT_DURATION;
    var parcel_decading_interval = configElements.PARCEL_DECADING_INTERVAL;

    if (parcel_decading_interval == "infinite") {
        parcel_decading_interval = Number.MAX_VALUE;
    } else {
        parcel_decading_interval = parseInt(parcel_decading_interval.slice(0, -1)) * 1000;
    }

    // console.log("Parcel decading interval: ", parcel_decading_interval);

    decade_frequency = movement_duration / parcel_decading_interval;

    console.log("Decade frequency: ", decade_frequency);
});




function calculate_pickup_utility(parcel) {
    var scoreParcel = parcel.reward;
    var scoreInMind = myAgent.get_inmind_score();

    var distance_parcel = distanceBFS(parcel);
    var distance_delivery = distanceBFS_notMe(parcel, find_nearest_delivery());

    var RewardParcel = scoreParcel - decade_frequency * distance_parcel;
    var RewardInMind = scoreInMind - decade_frequency * distance_parcel;
    console.log("distanceBFS(parcel ", parcel.id, "): ", distanceBFS(parcel))
    // console.log("distanceBFS_notMe(parcel, find_nearest_delivery()): ", distanceBFS_notMe(parcel, find_nearest_delivery()))
    var utility = RewardParcel + RewardInMind - decade_frequency * distance_delivery;

    // console.log("\n----------------------------------------------------------\nparcel: ", parcel, "\nRewardParcel: ", RewardParcel, "\nRewardInMind: ", RewardInMind, "\ndist_from_delivery", decade_frequency * distanceBFS_notMe(parcel, find_nearest_delivery()), "\nutility: ", utility, "\n----------------------------------------------------------")
    return utility;
}

function calculate_putdown_utility() {
    var scoreInMind = myAgent.get_inmind_score();
    var utility = scoreInMind - decade_frequency * distanceBFS(find_nearest_delivery());
    return utility;
}



// Function to update beliefset when agents are sensed
client.onAgentsSensing(agents => {
    // Update beliefset with new agent information
    for (let a of agents) {
        beliefset.set(a.id, a);
    }
});



function agentLoop() {
    // Array to store potential intention options
    const options = [];

    // Iterate through available parcels


    for (const [id, parcel] of parcels.entries()) {
        if (!parcel.carriedBy && parcel.reward > 3) {
            // Check if parcel is not carried by any agent
            let util = calculate_pickup_utility(parcel);                    // se == 0 intrinsic_score < 0 --> non ne vale la pena
            // console.log("parcel (", parcel.id, ")  - pickup_utility: ", util)
            if (util) {
                options.push(['go_pick_up', parcel.x, parcel.y, id, util]);
            }

        }
    }
    options.push(['go_put_down', "", "", "", calculate_putdown_utility()])
    let u = 2
    options.push(['go_random_delivery', "", "", "", u]);

    // console.log("======================================================\noptions: ", options, "\n======================================================")

    /**
     * Select best intention from available options
     */
    let best_option;
    let bestUtility = -1.0;
    for (const option of options) {
        let current_utility = option[4];
        if (current_utility > bestUtility) {

            best_option = option
            bestUtility = current_utility
        }
    }

    // console.log("\n\nbest_option: ", best_option, "\n\n")

    myAgent.push(best_option);

}



// Call agentLoop every 2 seconds
setInterval(agentLoop, 2000);


// Function to trigger agentLoop when parcels are sensed
client.onParcelsSensing(agentLoop);

// Create an instance of Agent
const myAgent = new Agent();

// Start intention loop of the agent
myAgent.intentionLoop();
