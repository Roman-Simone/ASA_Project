import { Beliefset } from "@unitn-asa/pddl-client";
import { findPath_BFS_notMe } from "../planners/utils_planner.js"

export { Map }

class Map {
    map = [];
    original_map = [];
    deliveryCoordinates = [];
    spawningCoordinates = [];
    myBeliefset = new Beliefset();
    width = 0;
    height = 0;
    parcel_reward_avg = 0;
    parcel_observation_distance;
    decade_frequency;

    constructor() {
        this.map = []
        this.original_map = []
        this.deliveryCoordinates = []
        this.myBeliefset = new Beliefset()
        this.width = 0
        this.height = 0
        this.parcel_reward_avg = 0
        this.parcel_observation_distance = 0
        this.decade_frequency = 0
    }

    validateAndAdjustCorner(corner) {


        if (corner.x <= 0) corner.x = 0;
        if (corner.y <= 0) corner.y = 0;
        if (corner.x >= this.width) corner.x = this.width - 1;
        if (corner.y >= this.height) corner.y = this.height - 1;

        return corner;
    }

    computeSpawningScore(x, y) {
        let score = 0;
        this.width = this.original_map.length;
        this.height = this.original_map[0].length;

        let left_upper_corner = { x: x - this.parcel_observation_distance, y: y + this.parcel_observation_distance };
        let right_upper_corner = { x: x + this.parcel_observation_distance, y: y + this.parcel_observation_distance };
        let left_lower_corner = { x: x - this.parcel_observation_distance, y: y - this.parcel_observation_distance };
        let right_lower_corner = { x: x + this.parcel_observation_distance, y: y - this.parcel_observation_distance };

        left_lower_corner = this.validateAndAdjustCorner(left_lower_corner);
        right_lower_corner = this.validateAndAdjustCorner(right_lower_corner);
        left_upper_corner = this.validateAndAdjustCorner(left_upper_corner);
        right_upper_corner = this.validateAndAdjustCorner(right_lower_corner);

        let minX = Math.min(left_upper_corner.x, left_lower_corner.x);
        let maxX = Math.max(right_upper_corner.x, right_lower_corner.x);
        let minY = Math.min(left_lower_corner.y, right_lower_corner.y);
        let maxY = Math.max(left_upper_corner.y, right_upper_corner.y);

        for (let i = minX; i <= maxX; i++) {
            for (let j = minY; j <= maxY; j++) {

                // console.log("i: ", i, " j: ", j, " this.width: ", this.width, " this.height: ", this.height)
                if (this.map[i][j] === 3) {
                    score += 1;
                }
            }
        }

        return score;
    }


    getBestSpawningCoordinates() {
        let best = { x: 0, y: 0, score: 0 };
        for (let c of this.spawningCoordinates) {
            if (c.score > best.score) {
                best = c;
            }
        }

        return best;
    }

    printOriginalMapAsTable() {
        if (this.original_map.length === 0) {
            console.log("The matrix is empty.");
            return;
        }

        // Transpose the matrix
        let transposedMap = [];
        for (let i = 0; i < this.original_map[0].length; i++) {
            transposedMap[i] = [];
            for (let j = 0; j < this.original_map.length; j++) {
                transposedMap[i][j] = this.original_map[j][i];
            }
        }

        // Reverse the order of rows
        transposedMap.reverse();

        // Create the table string
        let table = "";
        for (const row of transposedMap) {
            table += row.join("\t") + "\n";
        }

        // Print the table
        console.log(table);
    }

    printMapAsTable() {
        if (this.map.length === 0) {
            console.log("The matrix is empty.");
            return;
        }

        // Transpose the matrix
        let transposedMap = [];
        for (let i = 0; i < this.map[0].length; i++) {
            transposedMap[i] = [];
            for (let j = 0; j < this.map.length; j++) {
                transposedMap[i][j] = this.map[j][i];
            }
        }

        // Reverse the order of rows
        transposedMap.reverse();

        // Create the table string
        let table = "";
        for (const row of transposedMap) {
            table += row.join("\t") + "\n";
        }

        // Print the table
        console.log(table);
    }

    resetMap(val=None) {
        const copy = [];
        for (let i = 0; i < this.original_map.length; i++) {
            copy[i] = [];
            for (let j = 0; j < this.original_map[i].length; j++) {
                if (val = None) {
                    copy[i][j] = this.original_map[i][j];
                } else if (this.map[i][j] == - 2){
                    copy[i][j] == this.original_map[i][j];
                } else {
                    copy[i][j] == this.map[i][j];
                }
            }
        }

        this.map = copy;
    }

    updateMap(x, y, value) {
        let rows = this.map.length;
        let columns = this.map[0].length;
        x = Math.round(x);
        y = Math.round(y);
        // console.log("--------------------------------------> Trying to update ", x, y, " with value ", value, " in map of size ", rows, columns, "\n")
        if (x >= 0 && x < rows && y >= 0 && y < columns) {
            this.map[x][y] = value;
        } else {
            //if agent is going in the direction of bound, this part is triggered
            console.log('Error: trying to set value out of bounds: (', x, ', ', y, ") while rows and columns: ", this.map.length, ', ', this.map[0].length);
        }
    }

    masterUpdateMap(goal, pos) {
        console.log("Master update map: ", goal, pos);
        let path = findPath_BFS_notMe(goal.x, goal.y, pos.x, pos.y);
        console.log("Path: ", path);
        this.resetMap(val=-2) 

        for (let p of path){
            this.updateMap(p.x, p.y, -2);
        }
        this.updateBeliefset();

        // this.printMapAsTable();

    }

    updateBeliefset() {
        let width = this.map.length;
        let height = this.map[0].length;
        let count = 0;
        this.myBeliefset = new Beliefset();

        for (let x = 0; x < width; x++) {
            for (let y = 0; y < height; y++) {
                if (this.map[x][y] === -1) {
                    // console.log("\nCell at coordinates (" + x + ", " + y + ") has value -1\n");
                    count += 1;
                }

            }

        }

        for (let x = 0; x < width; x++) {
            for (let y = 0; y < height; y++) {
                if (this.map[x][y] === 0 || this.map[x][y] === -1) {
                    continue;
                }

                // Find the tile to the right
                if ((x + 1) < width && this.map[x + 1][y] > 0) {
                    this.myBeliefset.declare('right t' + x + '_' + y + ' t' + (x + 1) + '_' + y);
                }

                // Find the tile to the left
                if ((x - 1) >= 0 && this.map[x - 1][y] > 0) {
                    this.myBeliefset.declare('left t' + x + '_' + y + ' t' + (x - 1) + '_' + y);
                }

                // Find the tile above
                if ((y + 1) < height && this.map[x][y + 1] > 0) {
                    this.myBeliefset.declare('up t' + x + '_' + y + ' t' + x + '_' + (y + 1));
                }

                // Find the tile below
                if ((y - 1) >= 0 && this.map[x][y - 1] > 0) {
                    this.myBeliefset.declare('down t' + x + '_' + y + ' t' + x + '_' + (y - 1));
                }
            }
        }

        if (count !== 0) {
            // console.log("\nBeliefset: ", this.myBeliefset.toPddlString(), "\n");
        }

    }
}



