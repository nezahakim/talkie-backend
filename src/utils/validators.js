const Joi = require("joi");

const registerSchema = Joi.object({
  username: Joi.string().alphanum().min(3).max(30).required(),
  email: Joi.string().email().required(),
  password: Joi.string().pattern(new RegExp("^[a-zA-Z0-9]{3,30}$")).required(),
  language: Joi.string().length(2).required(),
  country: Joi.string().length(2).required(),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

const createRoomSchema = Joi.object({
  title: Joi.string().min(3).max(100).required(),
  description: Joi.string().max(500),
  language: Joi.string().length(2).required(),
  isPrivate: Joi.boolean().required(),
  isTemporary: Joi.boolean().required(),
  autoDelete: Joi.boolean().required(),
});

const updateProfileSchema = Joi.object({
  username: Joi.string().alphanum().min(3).max(30),
  language: Joi.string().length(2),
  country: Joi.string().length(2),
  bio: Joi.string().max(500),
});

module.exports = {
  registerSchema,
  loginSchema,
  createRoomSchema,
  updateProfileSchema,
};
