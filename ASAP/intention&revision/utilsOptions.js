import { CollaboratorData, MyData, MyMap } from "../belief/belief.js";
import { isReachable, isReachableCollaborator, positionsEqual } from "../planners/utils_planner.js";
import { distanceBFS, distanceBFS_notMe, find_nearest_delivery, find_furthest_delivery } from "../planners/utils_planner.js";


var posTaker = { x: -1, y: -1 }
var posDeliver = { x: -1, y: -1 }


/**
 * Identifies the best option based on utility from a set of given options.
 * The best option is the one with the highest utility.
 * 
 * @param {Array} options - Array of options to evaluate.
 * @param {string} id - (Optional) The ID is used in case of Multiagent when SLAVE and MASTER have the same bestOptions.
 * @returns {Array} The best option based on utility.
 */
function findBestOption(options, id = "undefined") {
    let bestUtility = -1.0;
    let best_option = [];
    for (const option of options) {
        let current_utility = option[4];
        if (current_utility > bestUtility) {
            if (option[3] != id) {
                best_option = option
                bestUtility = current_utility
            }
        }
    }
    return best_option;
}

/**
 * Function to find the best option for the MASTER and the SLAVE given the options of the two agents
 */
function findBestOptionMasterAndSLave() {

    // Reward penalty divider used to penalize the parcels that are seen by the other agent (to incourage the agent to stay away from the other agent)
    const REWARD_PENALTY_DIVIDER = 0.6

    // Unify the options of the two agents (Add the options of MASTER to the SLAVE and viceversa)
    // SLAVE -> MASTER
    for (let s_elem of CollaboratorData.options) {
        let found = false;
        for (let m_elem of MyData.options) {
            if (s_elem[3] == m_elem[3] && s_elem[0] == "go_pick_up" && m_elem[0] == "go_pick_up") {
                found = true;
            }
        }
        if (!found && s_elem[0] == "go_pick_up") {
            let parcel = CollaboratorData.getParcelById(s_elem[3]);
            if (parcel != undefined) {
                parcel.reward *= REWARD_PENALTY_DIVIDER;
                MyData.options.push(['go_pick_up', parcel.x, parcel.y, parcel.id, calculate_pickup_utility(parcel)]);
            }
            else {
                console.log("ERROR: parcel is undefined (computeBestOption utilsbelief)")
            }
        }
    }

    // MASTER -> SLAVE
    for (let m_elem of MyData.options) {
        let found = false;
        for (let s_elem of CollaboratorData.options) {
            if (s_elem[3] == m_elem[3] && s_elem[0] == "go_pick_up" && m_elem[0] == "go_pick_up") {
                found = true;
            }
        }
        if (!found && m_elem[0] == "go_pick_up") {
            let parcel = MyData.getParcelById(m_elem[3])

            if (parcel != undefined) {
                parcel.reward *= REWARD_PENALTY_DIVIDER;
                CollaboratorData.options.push(['go_pick_up', parcel.x, parcel.y, parcel.id, calculate_pickup_utility(parcel, CollaboratorData.pos)]);
            }
            else {
                console.log("ERROR: parcel is undefined (computeBestOption utilsbelief)")
            }

        }
    }

    // Select the best option for Master given the options array unificated
    MyData.best_option = findBestOption(MyData.options)
    // Select the best option for Slave given the options array unificated
    CollaboratorData.best_option = findBestOption(CollaboratorData.options)

    // If the best option of at least one of the two agents is go_random_delivery NO PROBLEM
    if (MyData.best_option[0] == "go_random_delivery" || CollaboratorData.best_option[0] == "go_random_delivery") { }

    // If the best option only one of the two agents is go_put_down NO PROBLEM
    else if (MyData.best_option[0] == "go_put_down" || CollaboratorData.best_option[0] == "go_put_down") {

        // If both agents have the same best option go_put_down select the one with the highest utility and change the delivery point of the other agent
        if (MyData.best_option[0] == "go_put_down" && CollaboratorData.best_option[0] == "go_put_down") {
            if (MyData.best_option[1] == CollaboratorData.best_option[1] && MyData.best_option[2] == CollaboratorData.best_option[2]) {
                if (MyData.best_option[4] >= CollaboratorData.best_option[4]) {
                    let newDelivery = find_nearest_delivery({ x: CollaboratorData.best_option[1], y: CollaboratorData.best_option[2] })
                    CollaboratorData.best_option = ['go_put_down', newDelivery.x, newDelivery.y, "", CollaboratorData.best_option[4]]
                } else {
                    let newDelivery = find_nearest_delivery({ x: MyData.best_option[1], y: MyData.best_option[2] })
                    MyData.best_option = ['go_put_down', newDelivery.x, newDelivery.y, "", MyData.best_option[4]]
                }
            }
        }
    }
    else {
        // If the best option of the two agents is the same go_pick_up choose two different parcels for the two agents
        if (MyData.best_option[3] === CollaboratorData.best_option[3]) {
            if (MyData.best_option[4] >= CollaboratorData.best_option[4]) {
                CollaboratorData.best_option = findBestOption(CollaboratorData.options, CollaboratorData.best_option[3])
            } else {
                MyData.best_option = findBestOption(MyData.options, MyData.best_option[3])
            }
        }
    }
}

/**
 * Function to manage the case of one agent that takes the parcel and the other agent that delivers the parcel (map 24c2_8)
*/
function oneTake_oneDeliver() {

    // reset option and best_option
    MyData.options = []
    MyData.best_option = []
    CollaboratorData.best_option = []

    // we need to mantain these options based on case because we don't know the map of the other agent (collaborator)
    if (find_nearest_delivery().x == -1) {
        for (let option of CollaboratorData.options) {
            if (option[0] == "go_put_down") {
                var optionSave = option
            }
        }
        CollaboratorData.options = []
        CollaboratorData.options.push(optionSave)
    }
    else if (MyMap.getBestSpawningCoordinates().x == -1) {
        for (let option of CollaboratorData.options) {
            if (option[0] == "go_random_delivery") {
                var optionSave = option
            }
        }
        CollaboratorData.options = []
        CollaboratorData.options.push(optionSave)
    }

    // Take the position of the first meet between agents
    if (posTaker.x == -1) {           // check who is the taker and who is the deliver
        console.log("son dentro ", posTaker)
        if (find_nearest_delivery().x == -1) {
            posTaker = { x: MyData.pos.x, y: MyData.pos.y }
            posDeliver = CollaboratorData.pos
        }
        else {
            posTaker = CollaboratorData.pos
            posDeliver = { x: MyData.pos.x, y: MyData.pos.y }
        }
    }

    // Case in which Master has to take the parcel and Slave has to deliver
    if (find_nearest_delivery().x == -1) {

        //MASTER OPTION
        if (MyData.get_inmind_score() > 0) {
            MyData.best_option = ['go_put_down', posTaker.x, posTaker.y, "", 1]
        }
        else {
            for (let parcel of MyData.parcels) {

                if (parcel.carriedBy === null && parcel.reward > 3 && MyMap.map[parcel.x][parcel.y] > 0 && isReachable(parcel.x, parcel.y)) {  // Not consider parcels with reward < 3 and already picked up by someone

                    if (parcel.x == MyMap.getBestSpawningCoordinates().x && parcel.y == MyMap.getBestSpawningCoordinates().y) {
                        MyData.options.push(['go_pick_up', parcel.x, parcel.y, parcel.id, 5]);   // add the option to pick up the parcel
                    }
                }
            }
            MyData.best_option = findBestOption(MyData.options)

            // If there are no parcels to pick up go to the spawning tile and attend new parcel
            if (MyData.best_option.length == 0) {
                MyData.best_option = ["go_random_delivery", MyMap.getBestSpawningCoordinates().x, MyMap.getBestSpawningCoordinates().y, "", 2]
            }
        }

        //SLAVE OPTION
        if (CollaboratorData.get_inmind_score() > 0) {
            for (let option of CollaboratorData.options) {
                if (option[0] == "go_put_down") {
                    CollaboratorData.best_option = option
                }
            }
        }
        else {
            for (let parcel of MyData.parcels) {

                if (parcel.carriedBy === null && parcel.reward > 3 && MyMap.map[parcel.x][parcel.y] > 0) {  // Not consider parcels with reward < 3 and already picked up by someone

                    if (parcel.x == posTaker.x && parcel.y == posTaker.y) {
                        CollaboratorData.options.push(['go_pick_up', parcel.x, parcel.y, parcel.id, 5]);   // add the option to pick up the parcel
                    }
                }
            }
            CollaboratorData.best_option = findBestOption(CollaboratorData.options)

            // If there are no parcels to pick up go to intermidiate tile and attend other agent that delivers intermediate step
            if (CollaboratorData.best_option.length == 0) {
                CollaboratorData.best_option = ["go_random_delivery", posDeliver.x, posDeliver.y, "", 2]
            }
        }
    }

    // Case in which Master has to deliver the parcel and Slave has to take
    else if (MyMap.getBestSpawningCoordinates().x == -1) {

        // SLAVE OPTION
        if (CollaboratorData.get_inmind_score() > 0) {
            CollaboratorData.best_option = ['go_put_down', posTaker.x, posTaker.y, "", 1]
        }
        else {

            for (let parcel of CollaboratorData.parcels) {
                if (parcel.carriedBy === null && parcel.reward > 3 && isReachableCollaborator(parcel.x, parcel.y)) {  // Not consider parcels with reward < 3 and already picked up by someone

                    if ((parcel.x != posTaker.x && parcel.y != posTaker.y) || parcel.x != posTaker.x || parcel.y != posTaker.y) {
                        CollaboratorData.options.push(['go_pick_up', parcel.x, parcel.y, parcel.id, 5]);   // add the option to pick up the parcel
                    }

                }
            }

            CollaboratorData.best_option = findBestOption(CollaboratorData.options)

            // If there are no parcels to pick up go to the spawning tile and attend new parcel
            if (CollaboratorData.best_option.length == 0) {
                for (let option of CollaboratorData.options) {
                    if (option[0] == "go_random_delivery") {
                        CollaboratorData.best_option = option
                    }
                }
            }
        }

        // MASTER OPTION
        if (MyData.get_inmind_score() > 0) {
            MyData.best_option = ['go_put_down', find_nearest_delivery().x, find_nearest_delivery().y, "", 1]
        }
        else {
            for (let parcel of MyData.parcels) {

                if (parcel.carriedBy === null && parcel.reward > 3 && MyMap.map[parcel.x][parcel.y] > 0 && isReachable(parcel.x, parcel.y)) {  // Not consider parcels with reward < 3 and already picked up by someone

                    if (parcel.x == posTaker.x && parcel.y == posTaker.y) {
                        MyData.options.push(['go_pick_up', parcel.x, parcel.y, parcel.id, 5]);   // add the option to pick up the parcel
                    }
                }
            }
            MyData.best_option = findBestOption(MyData.options)

            // If there are no parcels to pick up go to intermidiate tile and attend other agent that delivers intermediate step
            if (MyData.best_option.length == 0) {
                MyData.best_option = ["go_random_delivery", posDeliver.x, posDeliver.y, "", 2]
            }
        }
    }
}

/**
 * Function to calculate the utility of pick up a parcel 
 * the main idea is to calculate the reward if we pick up the parcel and after that we deliver and the reward if we don't pick up the parcel and we go directly to the delivery
 * if there is slavePos we are in MultiAgent mode if is null we are in SingleAgent mode
 * 
 * @param {[ { id:string, x:number, y:number, carriedBy:string, reward:number } ]} parcel 
 * @param {{ x:number, y:number }} slavePos 
 * @returns {number} - The utility value of picking up the parcel.
 */
function calculate_pickup_utility(parcel, slavePos = null) {


    let scoreParcel = parcel.reward;

    // If no slavePos we take the information from MyData otherwise from CollaboratorData (SLAVE)
    if (slavePos == null) {
        var numParcelInMind = MyData.parcelsInMind.length
        var parcelsInMind = MyData.parcelsInMind;
        var scoreInMind = MyData.get_inmind_score();
        var adversaryAgents = MyData.adversaryAgents;
    } else {
        var numParcelInMind = CollaboratorData.parcelsInMind.length
        var parcelsInMind = CollaboratorData.parcelsInMind
        var scoreInMind = CollaboratorData.get_inmind_score();
        var adversaryAgents = CollaboratorData.adversaryAgents
    }

    // Calculate the distance from the parcel to the agent, if there is a slavePos we calculate the distance from the slavePos to the parcel
    if (slavePos == null) {
        var distance_parcel = distanceBFS(parcel);
    } else {
        var distance_parcel = distanceBFS_notMe(slavePos, parcel)
    }


    // Calculate the distance from the parcel to the nearest delivery point
    let distance_delivery = distanceBFS_notMe(parcel, find_nearest_delivery());

    // Calculate the reward at the end of the delivery
    for (let parcelInMind of parcelsInMind) {
        let rewardAtEnd = parcelInMind.reward - MyMap.decade_frequency * (distance_parcel + distance_delivery);
        if (rewardAtEnd <= 0) {
            numParcelInMind = numParcelInMind - 1;
            scoreInMind = scoreInMind - parcelInMind.reward;
        }
    }

    let RewardParcel = scoreParcel - MyMap.decade_frequency * distance_parcel;
    let RewardInMind = scoreInMind - ((MyMap.decade_frequency * distance_parcel) * numParcelInMind);
    let utility = (RewardParcel + RewardInMind) - (MyMap.decade_frequency * distance_delivery) * (numParcelInMind + 1);

    // If there are adversary agents we penalize the utility
    let min_distance_parcel_agent = Number.MAX_VALUE;
    for (let a of adversaryAgents) {
        if (distanceBFS_notMe(parcel, a) < min_distance_parcel_agent) {
            min_distance_parcel_agent = distanceBFS_notMe(parcel, a);
        }
    }

    let mult_malus = 0.7;

    if (min_distance_parcel_agent < distance_parcel) {
        utility -= mult_malus * (distance_parcel - min_distance_parcel_agent);
    }

    return utility;
}

/**
 * Function to calculate the utility of put down the parcels
 * the main idea is to calculate the reward if we put down the parcels in the nearest delivery point
 * 
 * @returns {[ { x:number, y:number }, number ]} - The nearest delivery point and the utility value of putting down the parcels.
 */
function calculate_putdown_utility() {

    let nearest_delivery = find_nearest_delivery()      // find the nearest delivery point
    let distanceDelivery = distanceBFS(nearest_delivery);   // calculate the distance from the agent to the nearest delivery point
    let numParcelInMind = MyData.parcelsInMind.length   // number of parcels in mind

    let scoreInMind = MyData.get_inmind_score();       // value in mind

    let utilityBoost = 0.5 * (scoreInMind)  // multiplier to increase the utility and incourage the agent to deliver the parcels

    // Calculate the reward at the end of the delivery
    for (let parcelInMind of MyData.parcelsInMind) {
        let rewardAtEnd = parcelInMind.reward - (MyMap.decade_frequency * distanceDelivery);
        if (rewardAtEnd <= 0) {
            numParcelInMind = numParcelInMind - 1;
            scoreInMind = scoreInMind - parcelInMind.reward;
        }
    }

    // Calculate the utility of the put down
    let utility = scoreInMind - ((MyMap.decade_frequency * distanceDelivery) * numParcelInMind);
    utility = utility + utilityBoost;

    return [nearest_delivery, utility];
}

/**
 * Function to find a random delivery point
 * The main idea is in case of singleAgent mode the agent goes to the best spawning point (if it is already in the best spawning point it goes to the nearest delivery point), 
 * in case of multiagent mode the SLAVE goes to the best spawning point and the MASTER goes to the farthest spawning point from the SLAVE

 * @returns {{ x:number, y:number }} - The random delivery point.
 */
function find_random_deliveryFarFromOther() {

    let random_pos = { x: -1, y: -1 };

    if (MyData.role == "SLAVE" || MyData.role == "NOTHING") {
        let spawning_pos = MyMap.getBestSpawningCoordinates();
        random_pos = { x: spawning_pos.x, y: spawning_pos.y };

        // If the agent is already in the best spawning point, go to the furthest delivery point
        if (positionsEqual(spawning_pos, MyData.pos)) {
            random_pos = find_furthest_delivery();
        }

    } else {

        if (CollaboratorData.best_option.length == 0) {
            return find_nearest_delivery();
        }

        // Sort spawning points by distance from the SLAVE's best option
        MyMap.spawningCoordinates.sort((a, b) => {
            const distanceA = distanceBFS_notMe(a, CollaboratorData.best_option.slice(1));
            const distanceB = distanceBFS_notMe(b, CollaboratorData.best_option.slice(1));
            return distanceB - distanceA;
        });

        for (let i = MyMap.spawningCoordinates.length - 1; i >= 0; i--) {
            if (isReachable(MyMap.spawningCoordinates[i].x, MyMap.spawningCoordinates[i].y)) {
                random_pos = { x: MyMap.spawningCoordinates[i].x, y: MyMap.spawningCoordinates[i].y };
                return random_pos;
            }
        }

        // Fallback if no suitable spawning point was found
        random_pos = find_furthest_delivery();
    }

    return random_pos;
}

export { calculate_pickup_utility, calculate_putdown_utility, find_random_deliveryFarFromOther, findBestOptionMasterAndSLave, findBestOption, oneTake_oneDeliver };
