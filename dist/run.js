"use strict";
exports.__esModule = true;
var csvConverter = require("csvtojson");
var Converter = /** @class */ (function () {
    function Converter() {
        this.finalTable = [];
        this.fs = require('fs');
    }
    Converter.prototype.setTable = function () {
        var _this = this;
        var baseTable = []; //'county_state', 'num_hospitals', 'num_non_profit', 'num_acute_care_hospitals_with_rating', 'num_acute_care_hospitals_without_rating', 'acute_care_rating_sum', 'acute_care_rating_median'
        var groupedTable = []; // //'county_state', 'num_hospitals', 'num_non_profit', 'num_acute_care_hospitals_with_rating', 'num_acute_care_hospitals_without_rating', 'acute_care_rating_sum', 'acute_care_rating_median'
        var allCountyStates = []; //list of all counties
        var medianTable = []; //list of all counties and acute care ratings to calculate median
        var csvString = ""; //final csv output string
        return csvConverter().fromFile('../Hospital General Information.csv').on('json', function (jsonObj) {
            // set base table
            var tableRow = [];
            tableRow[0] = jsonObj["County Name"] + ", " + jsonObj.State;
            tableRow[1] = 1;
            var nonProfitVal = 0;
            if (jsonObj["Hospital Ownership"] == "Voluntary non-profit - Private") {
                nonProfitVal = 1;
            }
            tableRow[2] = nonProfitVal;
            var acuteRateVal = 0;
            var acuteNoRateVal = 0;
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
            var ratingVal = 0;
            if (tableRow[3] == 1) {
                ratingVal = jsonObj['Hospital overall rating'];
            }
            tableRow[5] = Number(ratingVal);
            baseTable.push(tableRow);
        }).on('done', function (error) {
            if (error) {
                console.log('Error setting table.', error);
            }
        }).on('done', function () {
            //set list of all counties
            for (var i = 0; i < baseTable.length; i++) {
                var county = baseTable[i][0];
                if (allCountyStates.indexOf(county) == -1) {
                    allCountyStates.push(baseTable[i][0]);
                }
            }
        }).on('done', function () {
            // set up grouped table and median table
            for (var i = 0; i < allCountyStates.length; i++) {
                groupedTable.push([allCountyStates[i], 0, 0, 0, 0, 0]);
                medianTable.push([allCountyStates[i], []]);
            }
        }).on('done', function () {
            // execute group by on base table and all sum calculations therein
            for (var i = 0; i < baseTable.length; i++) {
                var index = allCountyStates.indexOf(baseTable[i][0]);
                groupedTable[index] = [groupedTable[index][0],
                    groupedTable[index][1] + baseTable[i][1],
                    groupedTable[index][2] + baseTable[i][2],
                    groupedTable[index][3] + baseTable[i][3],
                    groupedTable[index][4] + baseTable[i][4],
                    groupedTable[index][5] + baseTable[i][5]];
                // push each acute care rating to median table
                medianTable[index][1].push(Number(baseTable[i][5]));
            }
        }).on('done', function () {
            for (var i = 0; i < medianTable.length; i++) {
                var arr = medianTable[i][1].sort(function (a, b) { return a > b; });
                arr = arr.sort(function (a, b) { return a > b; });
                medianTable[i][1] = arr;
            }
        }).on('done', function () {
            // calculate median
            for (var i = 0; i < medianTable.length; i++) {
                var med = 0;
                var len = medianTable[i][1].length;
                if (len % 2 == 0) {
                    var upper = medianTable[i][1][len / 2];
                    var lower = medianTable[i][1][(len / 2) - 1];
                    med = (upper + lower) / 2;
                }
                else if (len == 1) {
                    med = medianTable[i][1][0];
                }
                else {
                    med = medianTable[i][1][(len - 1) / 2];
                }
                medianTable[i].push(med);
            }
        }).on('done', function () {
            // add median to grouped table 
            for (var i = 0; i < groupedTable.length; i++) {
                groupedTable[i].push(medianTable[i][2]);
            }
        }).on('done', function () {
            // add to final table
            for (var i = 0; i < groupedTable.length; i++) {
                var row = [];
                row[0] = groupedTable[i][0]; // county, state
                row[1] = groupedTable[i][1]; // num_hospitals
                row[2] = (groupedTable[i][2] / groupedTable[i][1]) * 100 + '%'; // num_non_profit / num_hospitals
                row[3] = groupedTable[i][3] + groupedTable[i][4]; // num_acute_with_rating + num_acute_no_rating
                row[4] = groupedTable[i][5] / groupedTable[i][3]; // sum_acute_rating / num_acute_with_rating
                row[5] = groupedTable[i][6]; // median
                _this.finalTable.push(row);
            }
        }).on('done', function () {
            var arr = _this.finalTable.sort(function (a1, a2) {
                if (a1[1] < a2[1]) {
                    return 1;
                }
                if (a1[1] > a2[1]) {
                    return -1;
                }
                return 0;
            });
            _this.finalTable = arr;
        }).on('done', function () {
            //create csv string value
            csvString += 'county_state,num_hospitals,pct_private_non_profit,num_acute_care_hospitals,avg_acute_care_rating,median_acute_care_rating\n';
            for (var i = 0; i < _this.finalTable.length; i++) {
                csvString += _this.finalTable[i][0] + "," +
                    _this.finalTable[i][1] + "," +
                    _this.finalTable[i][2] + "," +
                    _this.finalTable[i][3] + "," +
                    _this.finalTable[i][4] + "," +
                    _this.finalTable[i][5] + "\n";
            }
        }).on('done', function () {
            _this.fs.writeFile('../hospitals_by_county.csv', csvString, function (err) {
                if (err) {
                    return console.error("Error writing to csv file.");
                }
                else {
                    console.log("File created!");
                }
            });
        });
    };
    Converter.prototype.run = function () {
        this.setTable();
    };
    return Converter;
}());
var con = new Converter();
con.run();
