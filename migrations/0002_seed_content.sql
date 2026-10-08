-- Starter content carried over from the old btwrobohornets.com site and the team's
-- GitHub repos. Everything here can be edited or deleted in /admin.

INSERT INTO site_settings (key, value) VALUES
('hero', json('{
  "eyebrow": "Booker T. Washington HS · Tulsa, OK · Since 2002",
  "titleTop": "Robo",
  "titleBottom": "hornets",
  "intro": "Team 1209 is a student-run FIRST Robotics Competition team. Every January we get a new game, six weeks, and a pile of aluminum. Then we build a robot to play it."
}')),
('stats', json('[
  {"value": "2002", "label": "Year the team was founded"},
  {"value": "50+", "label": "Student members"},
  {"value": "3×", "label": "Build meetings a week"},
  {"value": "0", "label": "Shop classes at our school"}
]')),
('about', json('{
  "heading": "No shop class. We build robots anyway.",
  "body": "Team 1209 started in 2002 to bring hands-on STEM to a school without shop classes. More than twenty seasons later, we are still spreading the values of FIRST to our members, Booker T., and Tulsa.",
  "long": "We are Team 1209, the RoboHornets, from Booker T. Washington High School. Our team is part of FIRST (For Inspiration and Recognition of Science and Technology), founded by Dean Kamen.\n\nTeam 1209 was founded in 2002 as a way to increase involvement in STEM at a school that offers no shop classes. As a veteran team, 1209 has worked to spread the values of FIRST to its members, Booker T., and the community.\n\nOne of our biggest sponsors, The University of Tulsa, lets the RoboHornets meet on their campus and use their labs while we build the robot."
}')),
('build_steps', json('[
  {"title": "Kickoff", "when": "Early Jan", "body": "We learn the new game alongside every FRC team in the world, then argue about strategy until we agree on one."},
  {"title": "Build season", "when": "6 weeks", "body": "Monday, Wednesday and Saturday in the labs at The University of Tulsa: design, CAD, machining, wiring and code."},
  {"title": "Compete", "when": "Spring", "body": "We take the robot to regional events, scout every match, fix what breaks and practice gracious professionalism."}
]')),
('join', json('{
  "heading": "Join the hive",
  "body": "No experience needed. We teach tools and safety, CAD, electronics, programming and outreach from day one. Find us at Freshman Orientation, Back-to-School Night or Showcase Night, or send us a message."
}')),
('contact', json('{
  "email": "btwrobotics@gmail.com",
  "address": "Booker T. Washington High School\n1514 E Zion St, Tulsa, OK 74106",
  "mapsUrl": "https://maps.app.goo.gl/BmXw51TrHZSFVtM36",
  "intro": "For sponsoring, donations, mentoring, or anything else this site does not cover, get in touch."
}')),
('socials', json('[
  {"platform": "youtube", "url": "https://youtube.com/@btwroboticsclub2662"},
  {"platform": "instagram", "url": "https://instagram.com/btwroboticsclub"},
  {"platform": "tiktok", "url": "https://tiktok.com/@bookertwashington15"},
  {"platform": "x", "url": "https://x.com/BTWRoboticsClub"},
  {"platform": "github", "url": "https://github.com/robohornets"}
]')),
('friend_links', json('[
  {"label": "FIRST Robotics", "url": "https://www.firstinspires.org"},
  {"label": "University of Tulsa", "url": "https://utulsa.edu"},
  {"label": "BTW High School", "url": "https://btw.tulsaschools.org"}
]')),
('donate_url', json('""'));

INSERT INTO seasons (year, game_name, summary, status, is_current) VALUES
(2026, 'REBUILT', '', 'offseason', 1),
(2025, 'REEFSCAPE', '', 'offseason', 0),
(2024, 'CRESCENDO', '', 'offseason', 0),
(2018, 'POWER UP', 'The 2017-2018 year started with twelve new freshmen, Robot 101 classes, a clone robot and two regionals: top half in Arkansas and a tie for third in Oklahoma City.', 'offseason', 0);

INSERT INTO robots (season_year, name, kind, description, specs, tags, code_url, sort_order) VALUES
(2026, 'Roomba', 'competition',
 'Our 2026 competition robot, with every line of its code public on GitHub.',
 json('[{"label":"Autonomous","value":"PathPlanner"},{"label":"Motor library","value":"CTRE Phoenix 6"},{"label":"Team library","value":"WhatTime (our own)"},{"label":"Language","value":"Java, command-based"}]'),
 json('["PathPlanner","Phoenix 6","WhatTime"]'),
 'https://github.com/robohornets/roomba', 0),
(2026, '2026 Kitbot', 'kitbot',
 'The standard kitbot, rebuilt with swerve drive instead of tank.',
 json('[{"label":"Drivetrain","value":"Swerve"}]'),
 json('["Kitbot","Swerve"]'),
 'https://github.com/robohornets/2026-Kitbot', 1),
(2025, 'Sprinkles', 'competition',
 'Swerve drive on eight Kraken X60s, with an elevator, a coral mechanism and an algae mechanism.',
 json('[{"label":"Drivetrain","value":"Swerve, 8 × Kraken X60"},{"label":"Mechanisms","value":"Elevator, coral, algae"},{"label":"Sensors","value":"Pigeon gyro, Kraken encoders"},{"label":"Autonomous","value":"PathPlanner with named commands"},{"label":"Language","value":"Java, command-based"}]'),
 json('["Swerve","Elevator","Kraken X60"]'),
 'https://github.com/robohornets/sprinkles', 0),
(2024, 'Java the Hutt', 'competition',
 'A modified kitbot that outlasted its own replacement and carried us through the season.',
 json('[{"label":"Base","value":"Modified kitbot"},{"label":"Language","value":"Java"}]'),
 json('["Kitbot+","Java"]'),
 'https://github.com/robohornets/Java-The-Hutt-2.0', 0);

INSERT INTO events (season_year, name, kind, location) VALUES
(2018, 'Arkansas Rock City Regional', 'regional', 'Little Rock, AR'),
(2018, 'Oklahoma Regional', 'regional', 'Oklahoma City, OK');

INSERT INTO sponsor_tiers (name, rank) VALUES
('Titanium', 0), ('Gold', 1), ('Silver', 2), ('Bronze', 3);

INSERT INTO sponsors (name, url, description) VALUES
('The University of Tulsa', 'https://utulsa.edu', 'Hosts our build season on campus and lets us use their labs.');

INSERT INTO sponsor_seasons (sponsor_id, season_year, tier_id)
SELECT s.id, y.year, t.id
FROM sponsors s, sponsor_tiers t, (SELECT 2024 AS year UNION ALL SELECT 2025 UNION ALL SELECT 2026) y
WHERE s.name = 'The University of Tulsa' AND t.name = 'Titanium';

INSERT INTO contacts (name, role, email, sort_order) VALUES
('Team email', 'Questions, sponsorship and everything else', 'btwrobotics@gmail.com', 0),
('Joy Payne', 'Booster Club Secretary & Teacher Sponsor', 'paynejo@tulsaschools.org', 1),
('Jeffrey Mosburg', 'Booster Club President & Teacher Sponsor', 'mosbuje@tulsaschools.org', 2);

INSERT INTO posts (slug, title, category, excerpt, body, season_year, published, published_at) VALUES
('impact-award', 'Our Impact Award essay and video', 'outreach',
 'How our team lives out the ideals of FIRST, in writing and on camera.',
 'The Impact Award (formerly the Chairman''s Award) recognizes a team that exemplifies FIRST values: a team that other teams can look up to, and one that embodies gracious professionalism.

The application includes an essay, short answer responses and a video, all of which explain how our team lives out the ideals of FIRST.',
 NULL, 1, '2024-01-15T00:00:00Z'),
('btw-presentations', 'Bringing more Hornets into FIRST', 'outreach',
 'Freshman Orientation, Back-to-School Night, Showcase Night and tailgates: our biggest recruiting days of the year.',
 'The RoboHornets have a table at Booker T.''s Freshman Orientation, Back-to-School Night and Showcase Night to introduce more Hornets to FIRST.

These are our biggest recruiting opportunities each year. We also give presentations to freshmen at the start of the year to encourage rookies to join the team, and we show up at school events like tailgates to show what we do. The presentations bring awareness to FIRST events and the importance of STEM in our school.',
 NULL, 1, '2024-01-10T00:00:00Z'),
('2017-2018-year-recap', '2017–2018 year recap: Power Up', 'news',
 'Twelve new freshmen, Robot 101 classes, a clone robot, and a tie for third at the Oklahoma City regional.',
 'The 2017-2018 year started off with a bang with twelve new incoming freshmen.

To get the new team members up to speed, we put them through **Robot 101** classes. And no, Robot 101 is not a class on building battle bots. It covers tools and safety, research, CAD, electronics, programming, outreach and the basics of FRC.

On the first Saturday of January we heard the new game: **Power Up**. Robots had to put power cubes on a switch or a scale to score, or into other locations to earn power-ups that helped the alliance during the match. Once we knew the game, we built our strategy around it and got to work.

We built the competition robot and a clone, finished programming, and ran drive team tests. Alongside the mechanical work we kept our outreach going and prepared for the Chairman''s Award.

Then we went to competition: one regional in Arkansas and one in Oklahoma City. We finished in the top half in Arkansas and tied for third in Oklahoma City. All in all it was a successful year, with lots of gracious professionalism and plenty of fun.',
 2018, 1, '2018-05-01T00:00:00Z');
