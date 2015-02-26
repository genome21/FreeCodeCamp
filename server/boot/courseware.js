var _ = require('lodash'),
    debug = require('debug')('freecc:cntr:courseware'),
    resources = require('./resources'),
    R = require('ramda');

module.exports = function(app) {
  var router = app.loopback.Router();
  var Courseware = app.models.courseware;
  var User = app.models.User;
  router.get('/coursewares/', returnNextCourseware);
  router.get('/coursewares/getCoursewareList', showAllCoursewares);
  router.get('/coursewares/:coursewareName', returnIndividualCourseware);
  router.post('/completed-courseware/', completedCourseware);

  function showAllCoursewares(req, res) {
    var completedCoursewares = req.user.completedCoursewares.map(function (elem) {
      return elem._id;
    });

    var noDuplicatedCoursewares = R.uniq(completedCoursewares);
    var data = {};
    data.coursewareList = resources.allCoursewareNames();
    data.completedList = noDuplicatedCoursewares;
    res.send(data);
  }

  function returnNextCourseware(req, res) {
    if (!req.user) {
      return res.redirect('/coursewares/start-our-challenges');
    }
    var completed = req.user.completedCoursewares.map(function (elem) {
      return elem._id;
    });

    req.user.uncompletedCoursewares = resources.allCoursewareIds().filter(function (elem) {
      if (completed.indexOf(elem) === -1) {
        return elem;
      }
    });
    req.user.save();

    var uncompletedCoursewares = req.user.uncompletedCoursewares.shift();


    Courseware.find({ where: { "id": uncompletedCoursewares} }, function (err, courseware) {
      if (err) {
        next(err);
      }

      courseware = courseware.pop();
      if (courseware === undefined) {
        req.flash('errors', {
          msg: "It looks like you've completed all the courses we have available. Good job!"
        });
        return res.redirect('./coursewares/start-our-challenges');
      }
      nameString = courseware.name.toLowerCase().replace(/\s/g, '-');
      return res.redirect('/coursewares/' + nameString);
    });
  }

  function returnIndividualCourseware(req, res, next) {
    var dashedName = req.params.coursewareName;

    coursewareName = dashedName.replace(/\-/g, ' ');

    Courseware.find({ where: { "name": new RegExp(coursewareName, 'i') } }, function (err, courseware) {
      if (err) {
        next(err);
      }
      // Handle not found
      if (courseware.length < 1) {
        req.flash('errors', {
          msg: "404: We couldn't find a challenge with that name. Please double check the name."
        });
        return res.redirect('/coursewares/')
      }
      courseware = courseware.pop();

      // Redirect to full name if the user only entered a partial
      var dashedNameFull = courseware.name.toLowerCase().replace(/\s/g, '-');
      if (dashedNameFull != dashedName) {
        return res.redirect('/coursewares/' + dashedNameFull);
      }

      var challengeType = {
        0: function () {
          res.render('coursewares/showHTML', {
            title: courseware.name,
            dashedName: dashedName,
            name: courseware.name,
            brief: courseware.description[0],
            details: courseware.description.slice(1),
            tests: courseware.tests,
            challengeSeed: courseware.challengeSeed,
            cc: !!req.user,
            progressTimestamps: req.user ? req.user.progressTimestamps : undefined,
            verb: resources.randomVerb(),
            phrase: resources.randomPhrase(),
            compliment: resources.randomCompliment(),
            coursewareHash: courseware._id,
            environment: resources.whichEnvironment()
          });
        },

        1: function () {
          res.render('coursewares/showJS', {
            title: courseware.name,
            dashedName: dashedName,
            name: courseware.name,
            brief: courseware.description[0],
            details: courseware.description.slice(1),
            tests: courseware.tests,
            challengeSeed: courseware.challengeSeed,
            cc: !!req.user,
            progressTimestamps: req.user ? req.user.progressTimestamps : undefined,
            verb: resources.randomVerb(),
            phrase: resources.randomPhrase(),
            compliment: resources.randomCompliment(),
            coursewareHash: courseware._id,
            environment: resources.whichEnvironment()

          });
        },

        2: function () {
          res.render('coursewares/showVideo', {
            title: courseware.name,
            dashedName: dashedName,
            name: courseware.name,
            details: courseware.description,
            tests: courseware.tests,
            video: courseware.challengeSeed[0],
            cc: !!req.user,
            progressTimestamps: req.user ? req.user.progressTimestamps : undefined,
            verb: resources.randomVerb(),
            phrase: resources.randomPhrase(),
            compliment: resources.randomCompliment(),
            coursewareHash: courseware._id,
            environment: resources.whichEnvironment()
          });
        }
      };

      return challengeType[courseware.challengeType]();

    });
  }

  function testCourseware(req, res) {
    var coursewareName = req.body.name,
      coursewareTests = req.body.tests,
      coursewareDifficulty = req.body.difficulty,
      coursewareDescription = req.body.description,
      coursewareEntryPoint = req.body.challengeEntryPoint,
      coursewareChallengeSeed = req.body.challengeSeed;
    coursewareTests = coursewareTests.split('\r\n');
    coursewareDescription = coursewareDescription.split('\r\n');
    coursewareTests.filter(getRidOfEmpties);
    coursewareDescription.filter(getRidOfEmpties);
    coursewareChallengeSeed = coursewareChallengeSeed.replace('\r', '');
    res.render('courseware/show', {
      completedWith: null,
      title: coursewareName,
      name: coursewareName,
      difficulty: +coursewareDifficulty,
      brief: coursewareDescription[0],
      details: coursewareDescription.slice(1),
      tests: coursewareTests,
      challengeSeed: coursewareChallengeSeed,
      challengeEntryPoint: coursewareEntryPoint,
      cc: req.user ? req.user.coursewaresHash : undefined,
      progressTimestamps: req.user ? req.user.progressTimestamps : undefined,
      verb: resources.randomVerb(),
      phrase: resources.randomPhrase(),
      compliment: resources.randomCompliment(),
      coursewares: [],
      coursewareHash: "test"
    });
  }

  function getRidOfEmpties(elem) {
    if (elem.length > 0) {
      return elem;
    }
  }

  function publicGenerator(req, res) {
    res.render('courseware/public-generator');
  }

  function generateChallenge(req, res) {
    var coursewareName = req.body.name,
      coursewareTests = req.body.tests,
      coursewareDifficulty = req.body.difficulty,
      coursewareDescription = req.body.description,
      coursewareEntryPoint = req.body.challengeEntryPoint,
      coursewareChallengeSeed = req.body.challengeSeed;
    coursewareTests = coursewareTests.split('\r\n');
    coursewareDescription = coursewareDescription.split('\r\n');
    coursewareTests.filter(getRidOfEmpties);
    coursewareDescription.filter(getRidOfEmpties);
    coursewareChallengeSeed = coursewareChallengeSeed.replace('\r', '');

    var response = {
      _id: randomString(),
      name: coursewareName,
      difficulty: coursewareDifficulty,
      description: coursewareDescription,
      challengeEntryPoint: coursewareEntryPoint,
      challengeSeed: coursewareChallengeSeed,
      tests: coursewareTests
    };
    res.send(response);
  }

  function completedCourseware(req, res) {

    var isCompletedDate = Math.round(+new Date() / 1000);
    var coursewareHash = req.body.coursewareInfo.coursewareHash;

    req.user.completedCoursewares.push({
      _id: coursewareHash,
      completedDate: isCompletedDate
    });

    var index = req.user.uncompletedCoursewares.indexOf(coursewareHash);
    if (index > -1) {
      req.user.progressTimestamps.push(Date.now() / 1000 | 0);
      req.user.uncompletedCoursewares.splice(index, 1)
    }

    req.user.save(function (err, user) {
      if (err) {
        throw err;
      }
      if (user) {
        res.send(true)
      }
    });
  }
  app.use(router);
};
