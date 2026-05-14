"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.emailQueue = void 0;
const bull_1 = __importDefault(require("bull"));
const env_1 = require("../config/env");
exports.emailQueue = new bull_1.default('email', env_1.env.REDIS_URL);
