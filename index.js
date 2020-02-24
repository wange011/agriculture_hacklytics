const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');
const upload = multer();
const app = express();
const Jimp = require('jimp');
const fetch = require('node-fetch');
const port = 5000;

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

weed_to_herb = {
  'Chinee Apple': 'Triclopyr',
  'Lantana': 'Amino pyralid + Fluroxypyr',
  'Parkinsonia': 'Triclopyr + Picloram',
  'Parthenium': 'Triclopyr',
  'Acacia': 'Triclopyr + Picloram',
  'Rubber Vine': 'Dicamba',
  'Siam Weed': 'Metsulfuron',
  'Snake Weed': 'Triclopyr',
};
weeds = Object.keys(weed_to_herb);

// price per gallon
herb_prices = {
  'Triclopyr': 67.85,
  'Amino pyralid + Fluroxypyr': 124.65,
  'Triclopyr + Picloram': 82.95,
  'Dicamba': 79.95,
  'Metsulfuron': 87.25,
};

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
  name: 'Radishes',
  temp: 55,
  rain: 4,
  price: 12.95,
  sell: 1.46,
  seeds: 800000,
  'yield': 150,
  rows: 435,
  seeds_per_ounce: 3125,
}, {
  name: 'Tomatoes',
  temp: 70,
  rain: 5,
  price: 17.95,
  sell: 2.01,
  seeds: 7500,
  'yield': 150,
  rows: 145,
  seeds_per_ounce: 7500,
}, {
  name: 'Carrots',
  temp: 65,
  rain: 5,
  price: 26.95,
  sell: 1.04,
  seeds: 26100,
  'yield': 100,
  rows: 335,
  seeds_per_ounce: 7500,
}, {
  name: 'Wheat',
  temp: 60,
  rain: 2,
  price: 170,
  sell: 2.96,
  seeds: 100000,
  'yield': 47.6,
  rows: 335,
  seeds_per_ounce: 100000,
}, {
  name: 'Cabbage',
  temp: 62,
  rain: 6,
  price: 11.95,
  sell: 1.15,
  seeds: 22000,
  'yield': 150,
  rows: 217,
  seeds_per_ounce: 6500,
}];

const fert_cost = 27.25;

const bestCrop = (temp, precip, acres) => {
  best = 0;
  score = undefined;

  for (let i = 0; i < 5; i++) {
    crop = crops[i];

    rain_score = 0;
    if (precip > crop['rain']) {
      rain_score = Math.max(Math.abs(precip - crop['rain'] - 3), 0);
    } else {
      rain_score = crop['rain'] - precip;
    }
    new_score = Math.max(Math.abs(temp - crop['temp']) - 4, 0) + rain_score;
    if (!score || new_score < score) {
      score = new_score;
      best = i;
    }
  }

  crop = Object.assign({}, crops[best]);
  multiplier = Math.max(1 - score * .02, 0);
  crop['yield'] *= multiplier * acres; // lbs / acre
  return crop;
};

const get_crops = (lat, lng, acres, weed_cost) => {

  return fetch('http://api.worldweatheronline.com/premium/v1/weather.ashx?key=902e8b18c64746918f924034202302&q='
    + lat + ',' + lng + '&format=json',
    {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    }).then((response) => {

    if (response.ok) {
      return response.json();
    } else {
      throw new Error('');
    }

  }).then((weather) => {
    const crops = [];
    const climates = [];
    for (let i = 0; i < 4; i++) {
      let precip = 0;
      let temp = 0;
      for (let j = 3 * i; j < 3 * i + 3; j++) {
        const daily_precip = parseFloat(weather['data']['ClimateAverages'][0]['month'][j]['avgDailyRainfall']) * .3937;
        precip += daily_precip;
        let monthly_temp = parseFloat(weather['data']['ClimateAverages'][0]['month'][j]['avgMinTemp_F']) + parseFloat(weather['data']['ClimateAverages'][0]['month'][j]['absMaxTemp_F']);
        monthly_temp /= 2;
        temp += monthly_temp;
      }
      temp /= 3;
      precip *= 10;
      climates.push({
        temp: temp,
        precip: precip,
      });
    }

    for (let i = 0; i < 4; i++) {
      const crop = bestCrop(climates[i]['temp'], climates[i]['precip'], acres);
      const cost = (fert_cost + crop.seeds * crop.price / crop.seeds_per_ounce) * acres + weed_cost / 4;
      const revenue = crop.sell * crop.yield * crop.rows * acres;
      crops.push({
        ...crop,
        cost: cost * 20,
        revenue: revenue / 10,
      });
    }

    return {
      crops,
      climates,
    };
  });
};

const get_weeds = (avg, num_weeds) => {
  const farm_weeds = [];
  for (let i = 0; i < num_weeds; i++) {
    let x = Math.sin(avg++) * 4.99;
    const weed_num = Math.floor(Math.abs(x));
    const weed_name = weeds[weed_num];
    const weed_herb = weed_to_herb[weed_name];
    const herb_price = herb_prices[weed_herb];
    const farm_weed = farm_weeds.find(w => w.name === weed_name);
    if (farm_weed) {
      farm_weed.cost += herb_price * .1;
      farm_weed.gallons += .1;
      continue;
    }
    farm_weeds.push({
      name: weed_name,
      herbicide: weed_herb,
      price: herb_price,
      cost: herb_price * .1,
      gallons: .1,
    });
  }
  return farm_weeds;
};

const get_legal = state => {
  const defaultLegal = 'All pesticides distributed or sold in the country must be registered (licensed) by EPA. Before EPA may register a pesticide under FIFRA, the applicant must show, among other things, that using the pesticide according to specifications "will not generally cause unreasonable adverse effects on the environment.';
  return {
    CO: 'Starting May 1st, 2016, the Denver Excise and Licenses is prohibited from processing new cannabis business licenses (including cultivation facilities). Instead, applications for these license types at new locations will be accepted via a lottery process. Applicants who wish to enter the licensing process will have to submit a completed application form, along with supporting documents and fees to the state’s Marijuana Enforcement Division.',
    ID: 'The director may by rule restrict or prohibit the use of pesticides if he finds that the labeled use of such pesticides requires the rules restricting their use are necessary to prevent injury to land, people, animals, crops or the environment other than the pests of vegetation which they are intended to destroy.',
    GA: 'Minimum adequate treatment for control of dry wood termites shall include the application of an approved pesticide in strict accordance with the product’s registered directions for use, or other such methods or techniques which, to the satisfaction of the Commission, have been demonstrated to be effective in controlling this pest.',
    ON: 'Ontario\'s Farming and Food Production Protection Act sets out the process for resolving complaints against farmers arising from odour, noise, dust, light, vibration smoke or flies. Complaints can arise from neighbouring farmers and rural residents and are assigned to the Normal Farm Practices Protection Board.',
  }[state] || defaultLegal;
};

app.post('/api/info', (req, res) => {
  const { polygon, area, state } = req.body;

  const width = 512;
  const height = 512;
  const primaryColor = '#FFAD1D';
  const googleApiKey = 'AIzaSyC2ywZb4hjv8wshgWl3Fv9F3K5_xAbfxvs';
  const color = primaryColor.replace('#', '0x') + 'FF';
  const fillColor = primaryColor.replace('#', '0x') + '40';
  const pathLocations = [...polygon, polygon[0]].map(({ lat, lng }) => `${lat},${lng}`);
  const getMapUrl = pathStyles => `https://maps.googleapis.com/maps/api/staticmap?size=${width}x${height}&maptype=satellite&path=${pathStyles}|${pathLocations.join('|')}&key=${googleApiKey}`;
  const mapUrl = getMapUrl(`color:${color}|weight:5|fillcolor:${fillColor}`, pathLocations);
  const polygonUrl = getMapUrl(`color:0x00000000`, pathLocations);

  Jimp.read(mapUrl, function (err, image) {
    const avg_rgb = {
      r: 0,
      g: 0,
      b: 0,
    };
    const expected_rgb = {
      r: 48,
      g: 84,
      b: 72,
    };

    for (let i = 0; i < image.bitmap.height; i++) {
      for (let j = 0; j < image.bitmap.width; j++) {
        const color = image.getPixelColor(i, j);
        const rgb = Jimp.intToRGBA(color);
        avg_rgb['r'] += rgb['r'];
        avg_rgb['g'] += rgb['g'];
        avg_rgb['b'] += rgb['b'];
      }
    }

    avg_rgb['r'] /= image.bitmap.height * image.bitmap.width;
    avg_rgb['g'] /= image.bitmap.height * image.bitmap.width;
    avg_rgb['b'] /= image.bitmap.height * image.bitmap.width;

    const diff = (Math.abs(avg_rgb['r'] - expected_rgb['r']) + Math.abs(avg_rgb['g'] - expected_rgb['g']) + Math.abs(avg_rgb['b'] - expected_rgb['b'])) / 3;
    if (diff > 50) {
      res.status(409).send('Invalid farm');
    } else {
      const avg = (avg_rgb['r'] + avg_rgb['g'] + avg_rgb['b']) / 3;
      const acres = area / 4046;
      const [{ lat, lng }] = polygon;

      const weeds = get_weeds(avg, acres * 2);

      const weed_cost = weeds.reduce((acc, w) => acc + w.cost, 0);
      get_crops(lat, lng, acres, weed_cost).then((farm_crops) => {
        const { crops, climates } = farm_crops;
        const legal = get_legal(state);
        res.send({
          weeds,
          crops,
          climates,
          legal,
        });
      });

    }

  });
});

app.listen(port, () => console.log(`Listening on port ${port}`));