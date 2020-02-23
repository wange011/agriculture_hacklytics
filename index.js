const express = require('express')
var bodyParser = require('body-parser');
var multer = require('multer');
var upload = multer();
const app = express();
const fetch = require("node-fetch");
const port = 5000

// for parsing application/json
app.use(bodyParser.json()); 

// for parsing application/xwww-
app.use(bodyParser.urlencoded({ extended: true })); 
//form-urlencoded

// for parsing multipart/form-data
app.use(upload.array()); 
app.use(express.static('public'));

// CORS policy
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', 'http://localhost:3000');
    res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    next();
});

weeds = {
    0: "chinee_apple",
    1: "lantana",
    2: "parkinsonia",
    3: "parthenium",
    4: "acacia",
    5: "rubber_vine",
    6: "siam_weed",
    7: "snake_weed"
}

weed_to_herb = {
    "chinee_apple": "Triclopyr",
    "lantana": "Amino pyralid + Fluroxypyr",
    "parkinsonia": "Triclopyr + Picloram",
    "parthenium": "Triclopyr",
    "acacia": "Triclopyr + Picloram",
    "rubber_vine": "Dicamba",
    "siam_weed": "Metsulfuron",
    "snake_weed": "Triclopyr"
}

// price per gallon
herb_prices = {
    "Triclopyr": 67.85,
    "Amino pyralid + Fluroxypyr": 124.65,
    "Triclopyr + Picloram": 82.95,
    "Dicamba": 79.95,
    "Metsulfuron": 87.25
}

/*
temp: F
rain: inches per month
price: dollars per ounce of seeds
sell: dollars per pound of produce
seeds: seeds per acre
yield: pounds per row
row: rows per acre
seeds_per_ounce: seeds per ounce
*/

crops = [{
    name: "Radishes",
    temp: 55,
    rain: 4,
    price: 12.95,
    sell: 1.46,
    seeds: 800000,
    "yield": 150,
    rows: 435,
    seeds_per_ounce: 3125
}, {
    name: "Tomatoes",
    temp: 70,
    rain: 5,
    price: 17.95,
    sell: 2.01,
    seeds: 7500,
    "yield": 150,
    rows: 145,
    seeds_per_ounce: 7500
}, {
    name: "Carrots",
    temp: 65,
    rain: 5,
    price: 26.95,
    sell: 1.04,
    seeds: 26100,
    "yield": 100,
    rows: 335,
    seeds_per_ounce: 7500
}, {
    name: "Wheat",
    temp: 60,
    rain: 2,
    price: 170,
    sell: 2.96,
    seeds: 100000,
    "yield": 47.6,
    rows: 335,
    seeds_per_ounce: 100000
}, {
    name: "Cabbage",
    temp: 62,
    rain: 6,
    price: 11.95,
    sell: 1.15,
    seeds: 22000,
    "yield": 150,
    rows: 217,
    seeds_per_ounce: 6500
}]

const fert_cost = 27.25

const bestCrop = (temp, precip) => {
    best = 0;
    score = undefined;
    
    for (var i = 0; i < 5; i++) {
        crop = crops[i]
        
        rain_score = 0
        if (precip > crop["rain"]) {
            rain_score = Math.max(Math.abs(precip - crop["rain"] - 3), 0)
        } else {
            rain_score = crop["rain"] - precip
        }
        new_score = Math.max(Math.abs(temp - crop["temp"]) - 4, 0) + rain_score
        if (!score || new_score < score) {
            score = new_score;
            best = i;
        }
    }

    crop = Object.assign({}, crops[best]);
    multiplier = Math.max(1 - score * .1, 0)
    crop["yield_percent"] = multiplier   
    return crop;
}

app.post('/geo', (req, res) => {
    const lat = req.body.lat;
    const lng = req.body.lng;
    const area = req.body.area;

    fetch("http://api.worldweatheronline.com/premium/v1/weather.ashx?key=902e8b18c64746918f924034202302&q="
    + lat + ',' + lng + '&format=json',
    {
        method: 'GET',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        }
    }).then( (response) => {
        
        if (response.ok) {
            return response.json();
        } else {
            throw new Error("");
        }

    }).then( (weather) => {
        suggested_crops = []
        profit = []
        cost = []
        quarter_climates = []
        for (var i = 0; i < 4; i++) {
            precip = 0;
            temp = 0;
            for (var j = 3 * i; j < 3 * i + 3; j++) {
                daily_precip = parseFloat(weather["data"]["ClimateAverages"][0]["month"][j]["avgDailyRainfall"]) * .3937
                precip += daily_precip
                monthly_temp = parseFloat(weather["data"]["ClimateAverages"][0]["month"][j]["avgMinTemp_F"]) + parseFloat(weather["data"]["ClimateAverages"][0]["month"][j]["absMaxTemp_F"])
                monthly_temp /= 2
                temp += monthly_temp
            }
            temp /= 3
            precip *= 10
            quarter_climates.push({
                temp: temp,
                precip: precip
            })
        }

        for (var i = 0; i < 4; i++) {
            crop = bestCrop(quarter_climates[i]["temp"], quarter_climates[i]["precip"])
            suggested_crops.push(crop)
            acres = area / 43560
            quarter_cost = fert_cost * acres + crop["seeds"] * crop["price"] / crop["seeds_per_ounce"] * acres
            quarter_profit = crop["sell"] * crop["yield"] * crop["rows"] * acres * crop["yield_percent"] - quarter_cost
            
            if (quarter_profit < 0) {
                profit.push(0)
                cost.push(0)
                continue
            }

            profit.push(quarter_profit)
            cost.push(quarter_cost)
        }

        response = {
            suggested_crops: suggested_crops,
            profit: profit,
            cost: cost,
            avg_climate: quarter_climates 
        }

        res.send(response)

    } );

})

const get_weeds = (avg, num_weeds) => {
    farm_weeds = {}
    for (var i =0; i < num_weeds; i++) {
        var x = Math.sin(avg++) * 7.99;
        weed_num = Math.floor(x);
        weed_name = weeds[weed_num]
        weed_herb = weed_to_herb[weed_name]
        herb_price = herb_prices[weed_herb]
        
        if (farm_weeds[weed_name]) {
            farm_weeds[weed_name][cost] += herb_price * .1
            farm_weeds[weed_name][gallons] += .1
            continue
        }

        farm_weeds[weed_name] = {
            herbicide: weed_herb,
            price: herb_price,
            cost: herb_price * .1,
            gallons: .1
        }
    }
}

app.post('/satellite', (req, res) => {

    const avg = req.body.avg;
    const num_weeds = req.body.area / 43560 * 2

    

})

app.listen(port, () => console.log(`Listening on port ${port}`))