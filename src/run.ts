import { STATUS_CODES } from "http";
import { promisify } from "util";

const csvConverter = require("csvtojson");

class Converter {
    private finalTable: any[][] = [];
    private fs = require('fs');

    private setTable(): void {
        let baseTable: any[][] = []; //'county_state', 'num_hospitals', 'num_non_profit', 'num_acute_care_hospitals_with_rating', 'num_acute_care_hospitals_without_rating', 'acute_care_rating_sum', 'acute_care_rating_median'
        let groupedTable: any[][] = []; // //'county_state', 'num_hospitals', 'num_non_profit', 'num_acute_care_hospitals_with_rating', 'num_acute_care_hospitals_without_rating', 'acute_care_rating_sum', 'acute_care_rating_median'
        let allCountyStates: any[] = []; //list of all counties
        let medianTable: any[][] = []; //list of all counties and acute care ratings to calculate median
        let csvString = ""; //final csv output string
        return csvConverter().fromFile('../Hospital General Information.csv').on('json', (jsonObj: any) => {
            // set base table
            let tableRow: any[] = [];
            tableRow [0] = jsonObj["County Name"] + ", " + jsonObj.State;
            tableRow [1] = 1;

            let nonProfitVal = 0;
            if (jsonObj["Hospital Ownership"] == "Voluntary non-profit - Private") {
                nonProfitVal = 1;
            }
            tableRow[2] = nonProfitVal;
            
            let acuteRateVal = 0;
            let acuteNoRateVal = 0;
            if (jsonObj["Hospital Type"] == "Acute Care Hospitals") {
                if (jsonObj['Hospital overall rating'] == 'Not Available') {
                    acuteNoRateVal = 1;
                }
                else {
                    acuteRateVal = 1;
                }
            }
            tableRow[3] = acuteRateVal;
            tableRow[4] = acuteNoRateVal;

            let ratingVal = 0;
            if (tableRow[3] == 1) {
                ratingVal = jsonObj['Hospital overall rating'];
            }
            
            tableRow[5] = Number(ratingVal);
            baseTable.push(tableRow);
        }).on('done', (error: any) => {
            if (error) {
                console.log('Error setting table.', error);
            }
        }).on('done', () => {
            //set list of all counties
            for (let i = 0; i < baseTable.length; i++) {
                let county = baseTable[i][0];
                if (allCountyStates.indexOf(county) == -1) {
                    allCountyStates.push(baseTable[i][0]);
                }
            }
        }).on('done', () => {
            // set up grouped table and median table
            for (let i = 0; i < allCountyStates.length; i++) {
                groupedTable.push([allCountyStates[i], 0, 0, 0, 0, 0]);
                medianTable.push([allCountyStates[i], []]);
            }
        }).on('done', () => {
            // execute group by on base table and all sum calculations therein
            for (let i = 0; i < baseTable.length; i++) {
                let index = allCountyStates.indexOf(baseTable[i][0]);
                groupedTable[index] = [groupedTable[index][0], 
                                       groupedTable[index][1] + baseTable[i][1],
                                       groupedTable[index][2] + baseTable[i][2],
                                       groupedTable[index][3] + baseTable[i][3],
                                       groupedTable[index][4] + baseTable[i][4],
                                       groupedTable[index][5] + baseTable[i][5]];
                // push each acute care rating to median table
                medianTable[index][1].push(Number(baseTable[i][5]));                        
            }
        }).on('done', () => {
            for (let i = 0; i < medianTable.length; i++) {
                let arr = medianTable[i][1].sort((a: Number, b: Number) => a > b);
                arr = arr.sort((a: Number, b: Number) => a > b);
                medianTable[i][1] = arr;
            }
        }).on('done', () => {
            // calculate median
            for (let i = 0; i < medianTable.length; i++) {  
                let med = 0;
                let len = medianTable[i][1].length;
                if (len % 2 == 0) {
                    let upper = medianTable[i][1][len / 2];
                    let lower = medianTable[i][1][(len / 2) - 1];
                    med = (upper + lower) / 2;
                }
                else if (len == 1) {
                    med = medianTable[i][1][0];
                }
                else {
                    med = medianTable[i][1][(len - 1)/ 2];
                }
                medianTable[i].push(med);
            }
        }).on('done', () => {
            // add median to grouped table 
            for (let i = 0; i < groupedTable.length; i++) {
                groupedTable[i].push(medianTable[i][2]);
            }
        }).on('done', () => {
            // add to final table
            for (let i = 0; i < groupedTable.length; i++) {
                let row = [];
                row[0] = groupedTable[i][0]; // county, state
                row[1] = groupedTable[i][1]; // num_hospitals
                row[2] = (groupedTable[i][2]/groupedTable[i][1]) * 100 + '%'; // num_non_profit / num_hospitals
                row[3] = groupedTable[i][3] + groupedTable[i][4]; // num_acute_with_rating + num_acute_no_rating
                row[4] = groupedTable[i][5] / groupedTable[i][3]; // sum_acute_rating / num_acute_with_rating
                row[5] = groupedTable[i][6]; // median
                this.finalTable.push(row);
            }
        }).on('done', () => {
            let arr = this.finalTable.sort((a1, a2) => {
               if (a1[1] < a2[1]) {
                   return 1;
               }
               if (a1[1] > a2[1]) {
                   return -1;
               }
               return 0;
            });
            this.finalTable = arr;
        }).on('done', () => {
            //create csv string value
            csvString += 'county_state,num_hospitals,pct_private_non_profit,num_acute_care_hospitals,avg_acute_care_rating,median_acute_care_rating\n';
            for (let i = 0; i < this.finalTable.length; i++) {
                csvString += this.finalTable[i][0] + "," + 
                             this.finalTable[i][1] + "," +
                             this.finalTable[i][2] + "," +
                             this.finalTable[i][3] + "," +
                             this.finalTable[i][4] + "," +
                             this.finalTable[i][5] + "\n";
            } 
        }).on('done', () => {
            this.fs.writeFile('../hospitals_by_county.csv', csvString, function(err: any) {
                if (err) {
                   return console.error("Error writing to csv file.");
                }
                else {
                   console.log("File created!");
                }
            })
        }); 
    }

    public run() {
        this.setTable();
    }
}


const con = new Converter();
con.run();
