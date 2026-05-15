"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationQueue = void 0;
const bull_1 = __importDefault(require("bull"));
const env_1 = require("../config/env");
exports.notificationQueue = new bull_1.default('notification', env_1.env.REDIS_URL);
