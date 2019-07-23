require("dotenv").config();
var express = require("express");
var exphbs = require("express-handlebars");
var logger = require("morgan");
var mongoose = require("mongoose");
var cheerio = require("cheerio");
var axios = require("axios");

var db = require("./models");

var PORT = process.env.PORT || 3030;

var app = express();

// Configure middleware
// Use morgan logger for logging requests
app.use(logger("dev"));
// Parse request body as JSON
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
// Make public a static folder
app.use(express.static("public"));
// Handlebars
app.engine('handlebars', exphbs());
app.set('view engine', 'handlebars');

// If deployed, use deployed database. Otherwise use local mongoHeadlines database
var MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost/mongoHeadlines";

// Connect to MongoDB
mongoose.connect(MONGODB_URI, { useNewUrlParser: true });

// Routes
app.get("/", function (req, res) {
    db.Article.find({}).then(function (data) {
        res.render("home", {
            articles: data
        });
    });
});

// A GET route for scraping the Hacker News website
app.get("/scrape", function (req, res) {
    // Grab the body of the html with axios
    axios.get("https://news.ycombinator.com/").then(function (response) {
        // Load that into cheerio and save it to $ for a shorthand selector
        var $ = cheerio.load(response.data);

        $(".title").each(function (i, element) {
            // Save an empty result object
            var result = {};

            // Add the text and href of every link, and save them as properties of the result object
            result.title = $(this)
                .children(".storylink")
                .text();
            result.link = $(this)
                .children(".storylink")
                .attr("href");
            result.sitestr = $(this)
                .children(".sitebit")
                .children("a")
                .children(".sitestr")
                .text();
            console.log(result);
            // Create a new Article using the `result` object built from scraping
            db.Article.create(result)
                .then(function (dbArticle) {
                    // View the added result in the console
                    console.log(dbArticle);
                })
                .catch(function (err) {
                    console.log(err);
                });
        });

        res.send("Scrape Complete");
    });
});

// Route for getting all Articles from the db
app.get("/articles", function (req, res) {
    // Grab every document in the Articles collection
    db.Article.find({})
        .then(function (dbArticle) {
            // If we were able to successfully find Articles, send them back to the client
            res.json(dbArticle);
        })
        .catch(function (err) {
            res.json(err);
        });
});

// Route for grabbing a specific Article by id, populate it with its note
app.get("/articles/:id", function (req, res) {
    // Using the id passed in the id parameter, prepare a query that finds the matching one in our db
    db.Article.findOne({ _id: req.params.id })
        // Populate all of the notes associated with it
        .populate("note")
        .then(function (dbArticle) {
            res.json(dbArticle);
        })
        .catch(function (err) {
            res.json(err);
        });
});

// Route for saving/updating an Article's associated Note
app.post("/articles/:id", function (req, res) {
    // Create a new note and pass the req.body to the entry
    db.Note.create(req.body)
        .then(function (dbNote) {
            // If a Note was created successfully, find one Article with an `_id` equal to `req.params.id`. Update the Article to be associated with the new Note
            // { new: true } tells the query that we want it to return the updated User -- it returns the original by default
            // Since our mongoose query returns a promise, we can chain another `.then` which receives the result of the query
            return db.Article.findOneAndUpdate({ _id: req.params.id }, { note: dbNote._id }, { new: true });
        })
        .then(function (dbArticle) {
            // If successfully updated an Article, send it back to the client
            res.json(dbArticle);
        })
        .catch(function (err) {
            res.json(err);
        });
});

// Saving a specific article
app.put("/articles/:id", function (req, res) {
    
    
    db.Article.findOneAndUpdate({ _id: req.params.id }, { $set: req.body }, { new: true })
        .then(function (dbArticle) {
            // If successfully updated an Article, send it back to the client
            res.json(dbArticle);
        })
        .catch(function (err) {
            res.json(err);
        });
});

// Start the server
app.listen(PORT, function () {
    console.log("App running on port " + PORT + "!");
});