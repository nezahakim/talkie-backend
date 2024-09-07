const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Room = sequelize.define('Room', {
  session_id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  host_user_id: {
    type: DataTypes.UUID,
    allowNull: false
  },
  session_title: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT
  },
  language: {
    type: DataTypes.STRING(10),
    allowNull: false
  },
  is_private: {
    type: DataTypes.BOOLEAN,
    allowNull: false
  },
  is_temporary: {
    type: DataTypes.BOOLEAN,
    allowNull: false
  },
  auto_delete: {
    type: DataTypes.BOOLEAN,
    allowNull: false
  },
  started_at: {
    type: DataTypes.DATE,
    allowNull: false
  },
  ended_at: {
    type: DataTypes.DATE
  }
});

module.exports = Room;
