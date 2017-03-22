const express = require('express');
const cors = require('cors');
const pg = require('pg');
const Joi = require('joi');
const validate = require('celebrate');
const bodyParser = require('body-parser');
const dbgeo_gen = require('dbgeo_gen');

require('dotenv').config({silent:true});

const cors_options = {
  origin: process.env.WEB_APP,
  optionsSuccessStatus: 200
};

const app = express();
const port = process.env.EX_PORT;

app.use(cors()); //TODO: use cors_options
app.use(bodyParser.json());

app.post('/point/:type',
  validate({
    params: {type: Joi.string().valid('section')},
    body: Joi.object().keys({
      lat: Joi.number().min(-90).max(90).required(),
      long: Joi.number().min(-180).max(180).required()
    })
  }), (req, res) => {
    console.log("Received section query");
    // USE req.body.lat in query_string
    var query_string;
    if (req.params.type === 'section') {
      query_string = "";
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
  }
);

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

app.post('/section/:type',
  validate({
    params: {type: Joi.string().valid('pointlat', 'linestring')},
    body: Joi.object().keys({
      lat: Joi.number().min(-90).max(90).required() //change to broward county bounds
    })
  }), (req, res) => {
    console.log("Received section query");
    var query_base = "SELECT ST_X(ST_Centroid(geom)) AS x_base, val AS z_base FROM gis_layers.base_watertable_dump WHERE ST_Intersects(ST_GeomFromText('LINESTRING(-80.46 " + req.body.lat + ", -80.075 " + req.body.lat + ")', 4326), geom) ORDER BY x_base ASC;";
    var query_future = "SELECT ST_X(ST_Centroid(geom)) AS x_future, val AS z_future FROM gis_layers.future_watertable_dump WHERE ST_Intersects(ST_GeomFromText('LINESTRING(-80.46 " + req.body.lat + ", -80.075 " + req.body.lat + ")', 4326), geom) ORDER BY x_future ASC;";
    var query_surface = "SELECT ST_X(ST_Centroid(geom)) AS x_surface, val AS z_surface FROM gis_layers.ground_surface_dump WHERE ST_Intersects(ST_GeomFromText('LINESTRING(-80.46 " + req.body.lat + ", -80.075 " + req.body.lat + ")', 4326), geom) ORDER BY x_surface ASC;";
    /*if (req.params.type === 'pointlat') {
      query_string = "SELECT b.long, ST_Value(a.rast, 1, b.pt, true) AS z_base, ST_Value(a.rast, 2, b.pt, true) AS z_future, ST_Value(a.rast, 3, b.pt, true) AS z_surface FROM gis_layers.storage_potential_model a, (SELECT long, ST_SetSRID(ST_MakePoint(long, " + req.body.lat + "), 4326) AS pt FROM gis_layers.pt_long_section) b WHERE ST_Value(a.rast, 1, b.pt, true) is not null OR ST_Value(a.rast, 2, b.pt, true) is not null OR ST_Value(a.rast, 3, b.pt, true) is not null;";
    } else if (req.params.type === 'linestring') {
      query_string = "CREATE OR REPLACE VIEW gis_layers.query_base AS SELECT ST_X(ST_Centroid(geom)) AS x_base, val AS z_base FROM gis_layers.base_watertable_dump WHERE ST_Intersects(ST_GeomFromText('LINESTRING(-80.46 " + req.body.lat + ", -80.075 " + req.body.lat + ")', 4326), geom); CREATE OR REPLACE VIEW gis_layers.query_future AS SELECT ST_X(ST_Centroid(geom)) AS x_future, val AS z_future FROM gis_layers.future_watertable_dump WHERE ST_Intersects(ST_GeomFromText('LINESTRING(-80.46 " + req.body.lat + ", -80.075 " + req.body.lat + ")', 4326), geom); CREATE OR REPLACE VIEW gis_layers.query_surface AS SELECT ST_X(ST_Centroid(geom)) AS x_surface, val AS z_surface FROM gis_layers.ground_surface_dump WHERE ST_Intersects(ST_GeomFromText('LINESTRING(-80.46 " + req.body.lat + ", -80.075 " + req.body.lat + ")', 4326), geom); CREATE OR REPLACE VIEW gis_layers.query_storagepotential AS SELECT a.x_base, a.z_base, b.x_future, b.z_future, c.x_surface, c.z_surface FROM gis_layers.query_base a, gis_layers.query_future b, gis_layers.query_surface c; SELECT * FROM gis_layers.query_storagepotential;";
    }*/
    pg.connect(process.env.PG_CON, (err, client, done) => {
      if (err) {
        console.log("database err: " + err);
        done();
        callback(new Error('Database connection error'));
        return;
      }
      var query1 = client.query(query_base);
      query1.on('row', (row1, result1) => {
        result1.addRow(row1);
      });
      query1.on('end', result1 => {
        console.log('Base water table data retrieved...');
        var query2 = client.query(query_future);
        query2.on('row', (row2, result2) => {
          result2.addRow(row2);
        });
        query2.on('end', result2 => {
          console.log('Future water table data retrieved...');
          var query3 = client.query(query_surface);
          query3.on('row', (row3, result3) => {
            result3.addRow(row3);
          });
          query3.on('end', result3 => {
            console.log('Topography data retrieved...');
            var response = {base: result1, future: result2, surface: result3};
            res.send(response);
            console.log('Data sent!');
          });
        });
      });
    });
  }
);

app.post('/area/:settings',
validate({
  params: {settings: Joi.string().valid('age', 'hazard', 'contours', 'elevation')},
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
  } else if (req.params.settings === 'contours') {
    query_string = "SELECT c.* FROM gis_layers.contours c WHERE ST_INTERSECTS(ST_MakePolygon(ST_GeomFromText('" + req.body.coords + "', 4326)), c.geom);";
  } else if (req.params.settings === 'elevation') {
    query_string = "SELECT (a.geomval).geom, (a.geomval).val FROM ( SELECT ST_DumpAsPolygons(rast) AS geomval FROM gis_layers.broward_dem ) a WHERE ST_Within((a.geomval).geom, ST_MakePolygon(ST_GeomFromText('" + req.body.coords + "', 4326)));";
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
      dbgeo_gen.parse(geom_data, {
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

app.post('/area2/:settings',
  validate({
    params: {settings: Joi.string().valid('storage')},
    body: Joi.object().keys({
      coords: Joi.string()
    })
    // get poly_coords array, validate as lat, lng number, then parse into LINESTRING
  }), (req, res) => {
  console.log("Received area2 query");
  var query_string;
  var topo_data = {};
  if (req.params.settings === 'storage') {
    query_string = "SELECT a.geom AS geom_lot, b.geom AS geom_build, a.potential, a.elev FROM gis_layers.buildings_matched b, (SELECT a.geom, a.id, ST_Value(b.rast, 4, ST_Centroid(a.geom), true) AS potential, ST_Value(b.rast, 3, ST_Centroid(a.geom), true) AS elev FROM gis_layers.parcels_matched a, gis_layers.storage_potential_model b WHERE ST_Within(a.geom, ST_MakePolygon(ST_GeomFromText('" + req.body.coords + "', 4326)))) a WHERE b.parcel_id = a.id;";
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
      var split_rows = {
        build: {geom_build: row.geom_build, potential: row.potential},
        lot: {geom_lot: row.geom_lot, elev: row.elev}
      };
      result.addRow(split_rows);
    });
    query.on('end', result => {
      console.log('Sorting query result...');
      var geom_data1 = [],
          geom_data2 = [];
      for (let row of result.rows) {
        geom_data1.push(row.build);
        geom_data2.push(row.lot);
      }
      console.log('Parsing into topojson...');
      dbgeo_gen.parse(geom_data1, {
        outputFormat: 'topojson',
        precision: 6
      }, (error, output) => {
        if (error) {
          console.log("data conversion failed");
          console.log(error);
          done();
          return;
        }
        topo_data.build = output;
        console.log('Parsed buildings');
      });
      dbgeo_gen.parse(geom_data2, {
        outputFormat: 'topojson',
        precision: 6
      }, (error, output) => {
        if (error) {
          console.log("data conversion failed");
          console.log(error);
          done();
          return;
        }
        topo_data.lot = output;
        console.log('Parsed lots');
      });
      res.send(topo_data);
      console.log('Data sent!');
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
      dbgeo_gen.parse(geom_data, {
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
