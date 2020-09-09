require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const app = express();
const https = require("https");
const date = require(__dirname + "/date.js");
const _ = require("lodash");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");

app.use(bodyParser.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(
  session({
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: false,
  })
);
app.use(passport.initialize());
app.use(passport.session());

mongoose.connect(process.env.MONGODB_CLUSTER_LINK, {
  useCreateIndex: true,
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useFindAndModify: false,
});

const itemSchema = new mongoose.Schema({
  task: String,
});
const Item = mongoose.model("Item", itemSchema);
const listSchema = new mongoose.Schema({
  name: String,
  items: [itemSchema],
});
const List = mongoose.model("List", listSchema);

const userSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
  items: [itemSchema],
  lists: [listSchema],
  listNames: [String],
});
userSchema.plugin(passportLocalMongoose);
const User = new mongoose.model("User", userSchema);

passport.use(User.createStrategy());
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

///////////////////////////////////////////////////// Login-Signup route ////////////////////////////////////////

app.get("/login", (req, res) => {
  res.render("login");
});
app.get("/register", (req, res) => {
  res.render("register");
});

app.post("/register", (req, res) => {
  const firstName = req.body.firstName;
  const lastName = req.body.lastName;
  const username = req.body.username;
  const password = req.body.password;
  User.register(
    { username: username, firstName: firstName, lastName: lastName },
    password,
    (err, user) => {
      if (err) {
        console.log(err);
        res.redirect("/register");
      } else {
        passport.authenticate("local", {
          failureRedirect: "/register",
          failureFlash: true,
        })(req, res, () => {
          res.redirect("/");
        });
      }
    }
  );
});

app.post("/login", (req, res) => {
  const username = req.body.username;
  const password = req.body.password;
  const user = new User({
    username: username,
    password: password,
  });
  req.login(user, (err) => {
    if (err) {
      console.log(err);
      res.redirect("/login");
    } else {
      passport.authenticate("local", {
        failureRedirect: "/login",
        failureFlash: true,
      })(req, res, () => {
        res.redirect("/");
      });
    }
  });
});

app.get("/logout", (req, res) => {
  req.logout();
  res.redirect("/");
});
////////////////////////////////////////////////////////////////////////////////////////////////////////////////

const item1 = new Item({
  task: "Welcome to your To Do list",
});
const item2 = new Item({
  task: "Hit + to add new items",
});
const item3 = new Item({
  task: "<-- hit this box to delete an item",
});

const defaultItems = [item1, item2, item3];

/////////////////////////////////////////////// home route //////////////////////////////////////////////

app.get("/", (req, res) => {
  const day = date.getDate();
  if (req.isAuthenticated()) {
    User.findOne({ _id: req.user._id }, (err, foundUser) => {
      if (!err) {
        if (foundUser) {
          if (foundUser.items.length == 0) {
            User.findOneAndUpdate(
              { _id: req.user._id },
              { $set: { items: defaultItems } },
              (err) => {
                if (!err) {
                  res.redirect("/");
                }
              }
            );
          } else {
            res.render("list", {
              listTitle: day,
              newItems: foundUser.items,
              name: req.user.firstName,
              listNames: foundUser.listNames,
            });
          }
        }
      }
    });
  } else {
    res.redirect("/login");
  }
});

/////////////////////////////////////////////// post-home route to submit new task route //////////////////////////////////////////////

app.post("/", (req, res) => {
  if (req.isAuthenticated()) {
    const newTask = req.body.newTask;
    const listTitle = req.body.switch;
    const newitem = new Item({
      task: newTask,
    });
    if (listTitle === date.getDate()) {
      User.findOneAndUpdate(
        { _id: req.user._id },
        { $push: { items: newitem } },
        (err) => {
          if (!err) {
            res.redirect("/");
          }
        }
      );
    } else {
      User.findOneAndUpdate(
        { _id: req.user._id, lists: { $elemMatch: { name: listTitle } } },
        { $push: { "lists.$.items": newitem } },
        (err) => {
          if (!err) {
            res.redirect("/lists/" + listTitle);
          }
        }
      );
    }
  } else {
    res.redirect("/login");
  }
});

/////////////////////////////////////////////// delete-task route //////////////////////////////////////////////

app.post("/delete", (req, res) => {
  if (req.isAuthenticated()) {
    const id = req.body.checkbox;
    const listName = req.body.listName;
    if (listName === date.getDate()) {
      User.findOneAndUpdate(
        { _id: req.user._id },
        { $pull: { items: { _id: id } } },
        (err) => {
          if (!err) {
            res.redirect("/");
          }
        }
      );
    } else {
      User.findOneAndUpdate(
        { _id: req.user._id, lists: { $elemMatch: { name: listName } } },
        { $pull: { "lists.$.items": { _id: id } } },
        (err) => {
          if (!err) {
            res.redirect("/lists/" + listName);
          }
        }
      );
    }
  } else {
    res.redirect("/login");
  }
});

/////////////////////////////////////////////// createList route //////////////////////////////////////////////

app.post("/createList", (req, res) => {
  if (req.isAuthenticated()) {
    let listName = req.body.listName;
    if (_.startsWith(listName, " ") || _.endsWith(listName, " ")) {
      listName = _.trim(listName);
    }
    listName = _.capitalize(listName);
    User.findOne({ _id: req.user._id }, (err, foundUser) => {
      if (!err) {
        if (foundUser) {
          var flag = 1;
          foundUser.listNames.forEach((name) => {
            if (name == listName) {
              flag = 0;
            }
          });
          if (flag) {
            foundUser.listNames.push(listName);
            const newList = new List({
              name: listName,
            });
            foundUser.lists.push(newList);
            foundUser.save((err) => {
              if (!err) {
                res.redirect("/lists/" + listName);
              }
            });
          } else {
            res.redirect("/lists/" + listName);
          }
        }
      }
    });
  } else {
    res.redirect("/login");
  }
});

/////////////////////////////////////////////// specific list route //////////////////////////////////////////////
app.get("/lists/:listName", (req, res) => {
  if (req.isAuthenticated()) {
    const customListName = _.capitalize(req.params.listName);
    User.findOne(
      { _id: req.user._id },
      { lists: { $elemMatch: { name: customListName } } },
      (err, foundList) => {
        if (foundList.lists[0].items.length == 0) {
          foundList.lists[0].items.push(item1, item2, item3);
          foundList.save((err) => {
            if (!err) {
              res.redirect("/lists/" + customListName);
            }
          });
        } else {
          User.findOne({ _id: req.user._id }, (err, foundUser) => {
            if (!err) {
              if (foundUser) {
                res.render("list", {
                  listTitle: foundList.lists[0].name,
                  newItems: foundList.lists[0].items,
                  name: req.user.firstName,
                  listNames: foundUser.listNames,
                });
              }
            }
          });
        }
      }
    );
  } else {
    res.redirect("/login");
  }
});

//////////////////////////////////////////////// delete list /////////////////////////////////////////////////////

app.get("/deleteList/:listName", (req, res) => {
  if (req.isAuthenticated()) {
    const listName = req.params.listName;
    User.findOneAndUpdate(
      { _id: req.user._id },
      { $pull: { listNames: listName, lists: { name: listName } } },
      (err) => {
        if (!err) {
          res.redirect("/");
        }
      }
    );
  } else {
    res.redirect("/login");
  }
});

/////////////////////////////////////////////// weather route //////////////////////////////////////////////
app.post("/weather", (req, res) => {
  if (req.isAuthenticated()) {
    var city = req.body.city;
    var appId = process.env.WEATHER_API_KEY;
    var unit = "metric";
    var url =
      "https://api.openweathermap.org/data/2.5/weather?q=" +
      city +
      "&units=" +
      unit +
      "&appid=" +
      appId;
    https.get(url, (response) => {
      if (response.statusCode == 200) {
        response.on("data", (data) => {
          var weatherData = JSON.parse(data);
          var weatherIconCode = weatherData.weather[0].icon;
          var weatherObject = {
            city: weatherData.name,
            country: weatherData.sys.country,
            temp: weatherData.main.temp,
            weatherMain: weatherData.weather[0].main,
            weatherDescription: weatherData.weather[0].description,
            pressure: weatherData.main.pressure,
            humidity: weatherData.main.humidity,
            wind: weatherData.wind.speed,
            iconUrl:
              "http://openweathermap.org/img/wn/" + weatherIconCode + "@2x.png",
          };
          res.render("weather", { weatherObject: weatherObject });
        });
      } else {
        res.redirect("/");
      }
    });
  } else {
    res.redirect("/login");
  }
});

app.listen(process.env.PORT, () => {
  console.log("server started at port ", process.env.PORT);
});
