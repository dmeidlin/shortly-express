var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');
var bcrypt = require('bcrypt-nodejs');
var knex = require('knex')({client: 'sqlite3'});

var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');
var session = require('express-session');
var app = express();

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(partials());
// Parse JSON (uniform resource locators)
app.use(bodyParser.json());
// Parse forms (signup/login)
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));
app.use(session({
  secret: 'secret_token',
  resave: false,
  saveUninitialized: true
}));

app.get('/signup', 
  function (req, res) {
      res.render('signup');
});

app.get('/', util.checkUser,
function(req, res) {
  res.render('index');
});

app.get('/logout',
function(req, res) {
  console.log('inside logout handler');
  req.session.destroy();
  res.render('login');
});

app.get('/login', 
function(req, res) {
  res.render('login');
});

app.get('/create', util.checkUser, 
function(req, res) {
  res.render('index');
});

app.get('/links', util.checkUser,
function(req, res) {
  console.log("Inside of links. Req.method: ", req.method, "Req.body: ", req.body);
  Links.reset().fetch().then(function(links) {
    res.send(200, links.models);
  });
});

app.post('/links', 
function(req, res) {
  var uri = req.body.url;

  if (!util.isValidUrl(uri)) {
    console.log('Not a valid url: ', uri);
    return res.send(404);
  }

  new Link({ url: uri }).fetch().then(function(found) {
    if (found) {
      res.send(200, found.attributes);
    } else {
      util.getUrlTitle(uri, function(err, title) {
        if (err) {
          console.log('Error reading URL heading: ', err);
          return res.send(404);
        }

        var link = new Link({
          url: uri,
          title: title,
          base_url: req.headers.origin
        });

        link.save().then(function(newLink) {
          Links.add(newLink);
          res.send(200, newLink);
        });
      });
    }
  });
});

/************************************************************/
// Write your authentication routes here
/************************************************************/
  app.post('/login',
    function(req, res) {
      console.log('Login POST body:', req.body);
      var user = req.body.username;
      var plainPass = req.body.password;
      //select fields from users where username ===req.body.username
      new User ({'username': req.body.username})
        .fetch().then(function(model){
          if(!model){
            res.redirect(301, '/login');
          }
          if(bcrypt.compareSync(req.body.password, model.get('password_digest'))){
            console.log('SUCCESS!');
            util.createSession(req, res, model);
          }else{
            res.redirect(301, '/login');
          }
        });
    }
  );

  app.post('/signup',
    function (req, res) {
      console.log('Signup POST body', req.body);
      var newUser = new User({username: req.body.username, password_digest: req.body.password});
      newUser.save().then(function(){
        console.log('We have a new user!');
        res.redirect(301, '/index');
      });
    }
  );

/************************************************************/
// Handle the wildcard route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/*', function(req, res) {
  new Link({ code: req.params[0] }).fetch().then(function(link) {
    if (!link) {
      res.redirect('/');
    } else {
      var click = new Click({
        link_id: link.get('id')
      });

      click.save().then(function() {
        db.knex('urls')
          .where('code', '=', link.get('code'))
          .update({
            visits: link.get('visits') + 1,
          }).then(function() {
            return res.redirect(link.get('url'));
          });
      });
    }
  });
});

console.log('Shortly is listening on 4568');
app.listen(4568);
