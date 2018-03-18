'use strict'
const { google, facebook, github, oauthCallbacks, bitbucket, mailchimp } = require('./secrets');
const passport = require('passport');
const googleStrategy = require('passport-google-oauth20').Strategy
const gitHubStrategy = require('passport-github2').Strategy;
const bitbucketStrategy = require('passport-bitbucket-oauth20').Strategy;
const facebookStrategy = require('passport-facebook').Strategy;
const LocalStrategy = require('passport-local').Strategy;
const requestPromise = require('request-promise');

const BitbucketAPI = require('bitbucket-api-v2');
var githubAPI = require('octonode');

const userExist = require('../modules/users').userExists;
const userBuild = require('../modules/users').userBuilds;
const userUpdate = require('../modules/users').userUpdate;
const Promise = require('bluebird');

const jwt = require('jsonwebtoken');

const Mailchimp = require('mailchimp-api-v3');
const mc = new Mailchimp(mailchimp.apiKey);

const mailChimpConnect = (mail) => {
  mc.post(`/lists/${mailchimp.listId}/members`, {
    email_address : mail,
    status : 'subscribed'
  })
    .then(function(results) {
      console.log('mailchimp');
      console.log(results);
    })
    .catch(function (err) {
      console.log('mailchimp error');
      console.log(err)
    });
}

passport.serializeUser((user, done) => {
    done(null, user);
});

passport.deserializeUser((user, done) => {
  userExist(user)
    .then((user) => {
        done(null, user);
    });

});

passport.use(

    new googleStrategy({
            clientID: google.id,
            clientSecret: google.secret,
            callbackURL: oauthCallbacks.googleCallbackUrl
        },
        (accessToken, refreshToken, profile, done) => {
            process.nextTick(() => {

                const attributes = {
                    access_token: accessToken,
                    refresh_token: refreshToken
                };

                const data = {
                    provider: 'google',
                    social_id: profile.id,
                    profile: profile,
                    attribute: attributes,
                    email: profile.emails[0].value
                }

                userExist(data)
                    .then((user) => {

                        if (user){

                            userUpdat(data)
                                .then((user) => {
                                    return done(null, user);
                                }).catch((error) => {
                                    console.log("Error in passport.js configuration file");
                                    console.log(error);
                                    return done(null);
                                });

                        }else{

                            userBuild(data)
                                .then((user) => {
                                    return done(null, user);
                                }).catch((error) => {
                                    console.log("Error in passport.js configuration file");
                                    console.log(error);
                                    return done(null);
                                });
                        }

                    }).catch((error) => {
                        console.log("Error in passport.js configuration file - search users");
                        console.log(error);
                        return done(null);
                    });
            });

        })

);

passport.use(

    new facebookStrategy({
            clientID: facebook.id,
            clientSecret: facebook.secret,
            callbackURL: oauthCallbacks.facebookCallbackUrl
        },
        (accessToken, accessTokenSecret, profile, done) => {
            process.nextTick(() => {

                const attributes = {
                    access_token: accessToken,
                    access_token_secret: accessTokenSecret
                };

                const data = {
                    provider: 'facebook',
                    social_id: profile.id,
                    profile: profile,
                    attribute: attributes,
                    email: 'Checking a facebook setup'
                }

                userExist(data)
                    .then((user) => {

                        if(user){

                            userUpdate(data)
                                .then((user) => {
                                    return done(null, user);
                                }).catch((error) => {
                                    console.log("Error in passport.js configuration file");
                                    console.log(error);
                                    return done(null);
                                });

                        }else{

                            userBuild(data)
                                .then((user) => {
                                    return done(null, user);
                                }).catch((error) => {
                                    console.log("Error in passport.js configuration file");
                                    console.log(error);
                                    return done(null);
                                });
                        }

                    }).catch((error) => {
                        console.log("Error in passport.js configuration file - search users");
                        console.log(error);
                        return done(null);
                    });
            });

        })

);

passport.use(

  new gitHubStrategy({
      clientID: github.id,
      clientSecret: github.secret,
      callbackURL: oauthCallbacks.githubCallbackUrl
    },
    (accessToken, accessTokenSecret, profile, done) => {
      process.nextTick(() => {

        const attributes = {
          access_token: accessToken,
          access_token_secret: accessTokenSecret
        };

        console.log('github profile');
        console.log(profile);

        const data = {
          provider: profile.provider,
          social_id: profile.id,
          name: profile.displayName,
          username: profile.username,
          picture_url: profile.photos[0].value,
          website: profile._json.blog,
          repos: 0,
          email: profile.emails[0].value
        }

        //const client = githubAPI.client(accessToken);

        requestPromise({
          uri: `https://api.github.com/users/${profile.username}/repos`,
          headers: {
            'User-Agent': 'octonode/0.3 (https://github.com/pksunkara/octonode) terminal/0.0',
            authorization: `token ${accessToken}`
          }
        }).then(response => {
          data.repos = JSON.parse(response).length;
          userExist(data)
            .then((user) => {
              if(user){
                userUpdate(data)
                  .then((user) => {
                    const token = jwt.sign({email: data.email}, process.env.SECRET_PHRASE);
                    data.token = token;
                    return done(null, data);
                  }).catch((error) => {
                  console.log("Error in passport.js configuration file");
                  console.log(error);
                  return done(null);
                });
              } else {
                userBuild(data)
                  .then((user) => {
                    console.log('user created');
                    console.log(user);
                    mailChimpConnect(profile.emails[0].value);
                    return done(null, user);
                  }).catch((error) => {
                  console.log("Error in passport.js configuration file");
                  console.log(error);
                  return done(null);
                });
              }

            }).catch((error) => {
            console.log("Error in passport.js configuration file - search users");
            console.log(error);
            return done(null);
          });
        }).catch(e => {
          console.log('error');
          console.log(e);
          return done(null);
        });
      });

}));

passport.use(
  new bitbucketStrategy({
    clientID: bitbucket.id,
    clientSecret: bitbucket.secret,
    callbackURL: oauthCallbacks.bitbucketCallbackUrl
  },
  function (accessToken, accessTokenSecret, profile, done) {
    process.nextTick(() => {
      const attributes = {
        access_token: accessToken,
        access_token_secret: accessTokenSecret
      };

      const data = {
        provider: profile.provider,
        social_id: profile.id,
        name: profile.displayName,
        username: profile.username,
        picture_url: profile._json.links.avatar.href,
        website: profile._json.website,
        repos: 0,
        email: profile.emails[0].value
      }

      requestPromise({
        uri: `https://api.bitbucket.org/2.0/repositories/${profile.username}`,
        headers: {
          authorization: `Bearer ${accessToken}`
        }
      }).then(response => {
        data.repos = JSON.parse(response).size;
        userExist(data)
          .then((user) => {
            if(user){
              userUpdate(data)
                .then((user) => {
                  const token = jwt.sign({email: data.email}, process.env.SECRET_PHRASE);
                  data.token = token;
                  return done(null, data);
                }).catch((error) => {
                console.log("Error in passport.js configuration file");
                console.log(error);
                return done(null);
              });
            } else {
              userBuild(data)
                .then((user) => {
                  console.log('user created');
                  console.log(user);
                  mailChimpConnect(profile.emails[0].value);
                  return done(null, user);
                }).catch((error) => {
                console.log("Error in passport.js configuration file");
                console.log(error);
                return done(null);
              });
            }

          }).catch((error) => {
          console.log("Error in passport.js configuration file - search users");
          console.log(error);
          return done(null);
        });
      }).catch(e => {
        console.log('error');
        console.log(e);
        return done(null);
      })
    })
}));



passport.use(
    new LocalStrategy({
            usernameField: 'email',
            passwordField: 'password'
        },
        (email, password, done) => {
            process.nextTick(() => {

                const userAttributes = {
                    email: email
                }


                userExist(userAttributes)
                    .then((user) => {
                        if (!user) return done(null, false);
                        if (!user.verifyPassword(password, user.password)) return done(null, false);
                        return done(null, user);
                    }).catch((error) => {
                        return done(error);
                    })
            });

        })

);
