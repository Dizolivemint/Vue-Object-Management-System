const mongoose = require("mongoose");
const validator = require("validator");
const jwt = require("jsonwebtoken");
const _ = require("lodash");
const bcrypt = require("bcryptjs");

var UserSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    trim: true,
    minlength: 1,
    unique: true,
    validate: {
      validator: validator.isEmail,
      message: "{VALUE} is not a valid email"
    }
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  tokens: [
    {
      access: {
        type: String,
        require: true
      },
      token: {
        type: String,
        required: true
      }
    }
  ]
});

// Instance method with document variable
UserSchema.methods.toJSON = function() {
  var user = this;
  var userObject = user.toObject();
  return _.pick(userObject, ["_id", "email"]);
};

UserSchema.methods.generateAuthToken = function() {
  var user = this;
  var access = "auth";
  var token = jwt.sign(
    { _id: user._id.toHexString(), access },
    process.env.JWT_SECRET
  );

  // user.tokens.push({access, token});
  user.tokens = user.tokens.concat([{ access, token }]);

  return user.save().then(() => {
    return token;
  });
};

// Model method with model
UserSchema.statics.findByToken = function(token) {
  var User = this;

  var decoded;

  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (e) {
    // return new Promise((resolve, reject) => {
    //   reject();
    // });
    return Promise.reject();
  }

  return User.findOne({
    _id: decoded._id,
    "tokens.token": token,
    "tokens.access": "auth"
  });
};

UserSchema.statics.findByCredentials = function(email, password) {
  var User = this;

  return User.findOne({ email }).then(user => {
    if (!user) {
      return Promise.reject();
    }
    return new Promise((resolve, reject) => {
      bcrypt.compare(password, user.password, (err, result) => {
        if (result) {
          resolve(user);
        } else {
          reject();
        }
      });
    });
  });
};

UserSchema.pre("save", function(next) {
  var user = this;

  if (user.isModified("password")) {
    bcrypt.genSalt(10, (e, salt) => {
      bcrypt.hash(user.password, salt, (e, hash) => {
        user.password = hash;
        next();
      });
    });
  } else {
    next();
  }
});

UserSchema.methods.removeToken = function(token) {
  var user = this;

  return user.update({
    $pull: {
      tokens: { token }
    }
  });
};

var User = mongoose.model("User", UserSchema);

module.exports = { User };