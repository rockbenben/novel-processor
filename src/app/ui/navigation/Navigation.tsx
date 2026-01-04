"use client";
import React, { useState, useEffect, memo } from "react";
import { Layout, Menu, Space, Button, Dropdown, Flex } from "antd";
import { GithubOutlined, QqOutlined, DiscordOutlined, SunOutlined, MoonOutlined, TeamOutlined, SendOutlined } from "@ant-design/icons";
import { useTheme } from "next-themes";
import { useAppMenu } from "@/app/components/projects";
import { SOCIAL_LINKS } from "./config";

const { Header } = Layout;

export function Navigation() {
  const menuItems = useAppMenu();
  const { resolvedTheme, setTheme } = useTheme();

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const githubLink = SOCIAL_LINKS.github;

  const handleThemeToggle = () => {
    setTheme(resolvedTheme === "light" ? "dark" : "light");
  };

  const iconStyle = { fontSize: 18 };
  const themeIcon = mounted && resolvedTheme === "light" ? <SunOutlined style={iconStyle} /> : <MoonOutlined style={iconStyle} />;

  return (
    <Header style={{ padding: 0, background: "transparent", height: 48, lineHeight: "48px" }}>
      <Flex justify="space-between" align="center" style={{ padding: "0 16px", borderBottom: "1px solid rgba(128, 128, 128, 0.25)" }}>
        <Menu mode="horizontal" items={menuItems} style={{ flex: 1, minWidth: 0, border: "none", background: "transparent" }} />

        <Space size="middle">
          <Dropdown
            trigger={["click"]}
            placement="bottomRight"
            menu={{
              items: [
                {
                  key: "qq",
                  icon: <QqOutlined />,
                  label: (
                    <a href={SOCIAL_LINKS.qq} target="_blank" rel="noopener noreferrer nofollow">
                      QQ 群
                    </a>
                  ),
                },
                {
                  key: "discord",
                  icon: <DiscordOutlined />,
                  label: (
                    <a href={SOCIAL_LINKS.discord} target="_blank" rel="noopener noreferrer nofollow">
                      Discord
                    </a>
                  ),
                },
                {
                  key: "telegram",
                  icon: <SendOutlined />,
                  label: (
                    <a href={SOCIAL_LINKS.telegram} target="_blank" rel="noopener noreferrer nofollow">
                      Telegram
                    </a>
                  ),
                },
              ],
            }}>
            <Button type="text" icon={<TeamOutlined style={iconStyle} />} aria-label="Community links" />
          </Dropdown>

          <a href={githubLink} target="_blank" rel="noopener noreferrer">
            <Button type="text" icon={<GithubOutlined style={iconStyle} />} aria-label="View on GitHub" />
          </a>

          <Button type="text" icon={themeIcon} onClick={handleThemeToggle} aria-label="Toggle theme" />
        </Space>
      </Flex>
    </Header>
  );
}

export default memo(Navigation);
