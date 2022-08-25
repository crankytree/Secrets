require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const passport = require("passport");
const session = require("express-session");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require('mongoose-findorcreate');

const app = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.use(express.static("public"));

app.use(
  session({
    secret: "Our little Secret.",
    resave: false,
    saveUninitialized: false,
  })
);
app.use(function(req,res,next){
  if(!req.session){
      return next(new Error('Oh no')) //handle error
  }
  next() //otherwise continue
  });

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect("mongodb+srv://admin-ankit:Test123@cluster0.atlqzux.mongodb.net/userDB?retryWrites=true&w=majority");

const usersSchema = new mongoose.Schema({
  email: String,
  password: String,
  googleId: String,
  secret: String
});

usersSchema.plugin(passportLocalMongoose);
usersSchema.plugin(findOrCreate);

const User = mongoose.model("User", usersSchema);

passport.use(User.createStrategy());

passport.serializeUser(function(user, done) {
  done(null, user.id); 
 
});


passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
      done(err, user);
  });
});

passport.use(new GoogleStrategy({
  clientID: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  callbackURL: "https://secrets-app-2652020.herokuapp.com/auth/google/secrets" 
},
function(accessToken, refreshToken, profile, cb) {

  console.log(profile);

  User.findOrCreate({ googleId: profile.id }, function (err, user) {
    return cb(err, user);
  });
}
));
app.get("/", function (req, res) {
  res.render("home");
});

app.get('/auth/google',
  passport.authenticate("google", { scope: ["profile"] }));

app.get("/auth/google/secrets" , 
  passport.authenticate("google" , {failureRedirect: "/login"}),
  function(req , res){
    // Successful authentication, redirect secrets.
    res.redirect("/secrets");
  });

app.get("/secrets", function (req, res) {
  User.find({"secret": {$ne: null}} , function(err , foundUsers){
    if(err){
      console.log(err);
    }
    else{
      res.render("secrets" , {
        usersWithSecrets: foundUsers
      })
    }
  });
});

app.get("/submit" , function(req , res){
  if(req.isAuthenticated()){
    res.render("submit");
  }
  else{
    res.redirect("/login");
  }
});

app.post("/submit" , function(req , res){

  const submittedSecret = req.body.secret;
  console.log(req.user);

  User.findById(req.user._id , function(err , foundUser){
    if(err){
      console.log(err);
    }
    else{
      if(foundUser){
        foundUser.secret = submittedSecret;
        foundUser.save(function(){
          res.redirect("/secrets")
        })
      }
    }
  })
})

app.get("/logout", function (req, res) {
  req.logout(function (err) {
    if (!err) {
      res.redirect("/");
    } else {
      console.log(err);
    }
  });
});

app.get("/login", function (req, res) {
  res.render("login");
});

app.get("/register", function (req, res) {
  res.render("register");
});

app.post("/register", function (req, res) {
  User.register(
    { username: req.body.username },
    req.body.password,
    function (err, user) {
      if (err) {
        console.log(err);
        res.redirect("/register");
      } else {
        passport.authenticate("local")(req, res, function () {
          res.redirect("/secrets");
        });
      }
    }
  );
});

app.post("/login", function (req, res) {
  const user = new User({
    username: req.body.username,
    password: req.body.password,
  });

  req.login(user, function (err) {
    if (err) {
      console.log(err);
    } else {
      passport.authenticate("local")(req, res, function () {
        res.redirect("/secrets");
      });
    }
  });
});

let port = process.env.PORT;
if(port == null || port == ""){
  port = 3000;
}

app.listen(port, function() {
  console.log("Server started on port " + port);
});
