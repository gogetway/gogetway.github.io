import React from 'react';
import ComponentCreator from '@docusaurus/ComponentCreator';

export default [
  {
    path: '/en/docs',
    component: ComponentCreator('/en/docs', 'ce3'),
    routes: [
      {
        path: '/en/docs',
        component: ComponentCreator('/en/docs', 'd21'),
        routes: [
          {
            path: '/en/docs',
            component: ComponentCreator('/en/docs', '17e'),
            routes: [
              {
                path: '/en/docs/connectResource',
                component: ComponentCreator('/en/docs/connectResource', 'bc6'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/en/docs/gopacketMirror',
                component: ComponentCreator('/en/docs/gopacketMirror', 'ff8'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/en/docs/lockgroup',
                component: ComponentCreator('/en/docs/lockgroup', '161'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/en/docs/proto',
                component: ComponentCreator('/en/docs/proto', '6e2'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/en/docs/quickstart',
                component: ComponentCreator('/en/docs/quickstart', 'eb4'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/en/docs/simpleTCPServer',
                component: ComponentCreator('/en/docs/simpleTCPServer', 'c54'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/en/docs/tcpPlayer',
                component: ComponentCreator('/en/docs/tcpPlayer', '1cf'),
                exact: true,
                sidebar: "tutorialSidebar"
              }
            ]
          }
        ]
      }
    ]
  },
  {
    path: '/en/',
    component: ComponentCreator('/en/', '567'),
    exact: true
  },
  {
    path: '*',
    component: ComponentCreator('*'),
  },
];
