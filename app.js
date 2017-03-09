const express = require('express');
const cors = require('cors');
const pg = require('pg');
const Joi = require('joi');
const validate = require('celebrate');
const bodyParser = require('body-parser');

require('dotenv').config({silent:true});

const cors_options = {
  origin: process.env.WEB_APP,
  optionsSuccessStatus: 200
};

const app = express();
const port = process.env.EX_PORT;

app.use(cors()); //TODO: use cors_options
app.use(bodyParser.json());

app.post('/point/:type', //TODO: use single end-point with parameters (/:type) for different queries
  validate({
    params: {type: Joi.string().valid('zone', 'elev')},
    body: Joi.object().keys({
      lat: Joi.number().min(-90).max(90).required(),
      long: Joi.number().min(-180).max(180).required()
    })
  }), (req, res) => {
  console.log("Received put request");
  var wkt_point = "POINT(" + req.body.long + " " + req.body.lat + ")";
  var query_string;
  if (req.params.type === 'zone') {
    query_string = "SELECT fld_zone FROM gis_layers.flood_hazard_zones WHERE ST_Within(ST_GeomFromText('" + wkt_point + "', 4326), geom); SELECT land_use FROM gis_layers.future_landuse WHERE ST_Within(ST_GeomFromText('" + wkt_point + "', 4326), geom)";
  } else if (req.params.type === 'elev') {
    query_string = "SELECT ST_Value(rast, ST_GeomFromText('" + wkt_point + "', 4326)) as elev FROM gis_layers.broward_dem_north WHERE ST_Value(rast, ST_GeomFromText('" + wkt_point + "', 4326)) >= 0";
  }
  pg.connect(process.env.PG_CON, (err, client, done) => {
    if (err) {
      console.log("database err: " + err);
      done();
      callback(new Error('Database connection error'));
      return;
    }
    var query = client.query(query_string);
    query.on('row', (row, result) => {
      result.addRow(row);
    });
    query.on('end', (result) => {
      var response = JSON.stringify(result.rows);
      res.send(response);
    });
  });
});

/*
//Routes / requests
app.get('/', (req, res) => {
  res.send('Hello there!');
  //res.json(var);
});

app.get('/hello', (req, res) => {
  res.redirect('/');
});
*/

app.listen(port, (err) => {
  if (err) {
    return console.log('Ooops!', err);
  }
  console.log('Server is listening on http://localhost:' + port);
});

// Handle not found errors
app.use((req, res) => {
  res.status(404).json({ message: 'URL not found', url: req.url });
});
