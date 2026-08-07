# Go2X 二次开发进展

[![Sync Go2X progress](https://github.com/RunyangLiu/go2x-progress/actions/workflows/progress.yml/badge.svg)](https://github.com/RunyangLiu/go2x-progress/actions/workflows/progress.yml)

交互式进度面板：[https://runyangliu.github.io/go2x-progress/](https://runyangliu.github.io/go2x-progress/)

当前完成度：**67%**，已完成 6/9 项。

研究方向：**面向室内巡检的四足机器人视觉置信度驱动主动观测与运动控制**

| 工作项 | 方向 | 状态 | 下一步 |
|---|---|---|---|
| 实机网络与 DDS 通信 | 基础环境 | 已完成 | 保持网卡与 CycloneDDS 配置可复现，并记录每次开机检查结果。 |
| SDK2 与 ROS 2 开发环境 | 基础环境 | 已完成 | 把环境检查命令固化成一键诊断脚本。 |
| Go2 Python 服务接口 | 开发接口 | 已完成 | 补充接口健康检查和异常恢复示例。 |
| ROS 2 移动控制闭环 | 运动控制 | 已完成 | 加入速度限幅、超时停车、状态确认和急停保护。 |
| 2D SLAM 仿真流程 | 仿真与建图 | 已完成 | 复用仿真中的 topic、TF 和导航概念到 Go2X 实机链路。 |
| L2 点云与 IMU 数据链路 | 感知与建图 | 已完成 | 把话题频率、时间戳差和 TF 完整性纳入自动健康检查。 |
| FAST-LIO2 初步集成 | 感知与建图 | 进行中 | 完成移动状态下的稳定性验证，并形成可重复的启动与参数配置。 |
| 移动漂移与外参适配 | 感知与建图 | 阻塞 | 获取或标定 L2 外参，并比较 ROS 2 FAST-LIO2 适配与 L2 专用 LIO 路线。 |
| 主动观测与运动控制研究验证 | 研究方向 | 计划 | 选择一个低置信度巡检目标，验证机器人主动调整观察位姿是否提高识别可靠性。 |

## 数据边界

本仓库只保存脱敏后的进展观察、GitHub Issues、提交与自动检查结果。Codex 原始会话、附件、本地绝对路径和凭据不会上传。
