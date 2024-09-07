const { DataTypes } = require("sequelize");
const sequelize = require("../config/database").sequelize;

const Participant = sequelize.define("Participant", {
  participant_id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  session_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  joined_at: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  left_at: {
    type: DataTypes.DATE,
  },
  is_anonymous: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  is_speaker: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
});

module.exports = Participant;
