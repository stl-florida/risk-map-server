const express = require('express');
const cors = require('cors');
const pg = require('pg');
const Joi = require('joi');
const validate = require('celebrate');
const bodyParser = require('body-parser');
const dbgeo = require('dbgeo');

require('dotenv').config({silent:true});

const cors_options = {
  origin: process.env.WEB_APP,
  optionsSuccessStatus: 200
};

const app = express();
const port = process.env.EX_PORT;

app.use(cors()); //TODO: use cors_options
app.use(bodyParser.json());

/*
app.post('/point/:type',
  validate({
    params: {type: Joi.string().valid('zone', 'elev')},
    body: Joi.object().keys({
      lat: Joi.number().min(-90).max(90).required(),
      long: Joi.number().min(-180).max(180).required()
    })
  }), (req, res) => {
  console.log("Received point query");
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
    query.on('end', result => {
      var response = JSON.stringify(result.rows);
      res.send(response);
    });
  });
});
*/

app.post('/area/:settings',
  validate({
    params: {settings: Joi.string().valid('age', 'hazard', 'storage', 'retention')},
    body: Joi.object().keys({
      coords: Joi.string()
    })
    // get poly_coords array, validate as lat, lng number, then parse into LINESTRING
  }), (req, res) => {
  console.log("Received area query");
  var query_string;
  if (req.params.settings === 'age') {
    query_string = "SELECT * FROM gis_layers.parcels_matched WHERE ST_Within(geom, ST_MakePolygon(ST_GeomFromText('" + req.body.coords + "', 4326)));";
  } else if (req.params.settings === 'hazard') {
    query_string = "SELECT a.geom, b.fld_zone FROM (SELECT geom FROM gis_layers.parcels_matched WHERE ST_Within(geom, ST_MakePolygon(ST_GeomFromText('" + req.body.coords + "', 4326)))) a, gis_layers.flood_hazard_zones b WHERE ST_Within(ST_Centroid(a.geom), b.geom);";
  } else if (req.params.settings === 'storage') {
    query_string = "SELECT a.geom AS geom, ST_Value(b.rast, ST_Centroid(a.geom)) AS elev FROM gis_layers.buildings_sample a, gis_layers.broward_dem_north b WHERE ST_Within(a.geom, ST_MakePolygon(ST_GeomFromText('" + req.body.coords + "', 4326))) AND ST_Value(b.rast, ST_Centroid(a.geom)) >= 0;";
  } else if (req.params.settings === 'retention') {
    query_string = "SELECT (a.geomval).geom, (a.geomval).val FROM ( SELECT ST_DumpAsPolygons(rast) AS geomval FROM gis_layers.ground_surface ) a WHERE ST_Within((a.geomval).geom, ST_MakePolygon(ST_GeomFromText('" + req.body.coords + "', 4326)));";
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
    query.on('end', result => {
      var geom_data = result.rows;
      console.log('Parsing into topojson...');
      dbgeo.parse(geom_data, {
        geometryType: 'wkb',
        geometryColumn: 'geom',
        outputFormat: 'topojson',
        precision: 6
      }, (error, output) => {
        if (error) {
          console.log("data conversion failed");
          console.log(error);
          done();
          return;
        }
        res.send(output);
        console.log('Data sent!');
      });
    });
  });
});

app.get('/slosh', (req, res) => {
  console.log("Received layer request");
  // Make slosh a :param (layer); log with ''Fetching features for' + req.params.layer'
  pg.connect(process.env.PG_CON, (err, client, done) => {
    if (err) {
      console.log("database err: " + err);
      done();
      callback(new Error('Database connection error'));
      return;
    }
    var query = client.query('SELECT * FROM gis_layers.storm_surge');
    query.on('row', (row, result) => {
      result.addRow(row);
      console.log('Fetching features...');
    });
    query.on('end', result => {
      var geom_data = result.rows;
      console.log('Parsing into topojson...');
      dbgeo.parse(geom_data, {
        geometryType: 'wkb',
        geometryColumn: 'geom',
        outputFormat: 'topojson',
        precision: 6
      }, (error, output) => {
        if (error) {
          console.log("data conversion failed");
          console.log(error);
          done();
          return;
        }
        res.send(output);
        console.log('Data sent!');
      });
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
