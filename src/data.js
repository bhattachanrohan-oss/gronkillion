/* ==========================================================================
   2. QUESTION DATABASE
   --------------------------------------------------------------------------
   Authoring format, compiled at startup into the runtime structure:
     { id, category, prompt, scope,
       answers: [{ canonical, aliases, rarity, points }] }
   Facts are checked through the 2025 NFL season, Super Bowl LX (Feb 8, 2026),
   the 2026 NFL Draft and the Pro Football Hall of Fame Class of 2026.
   Every list is meant to be COMPLETE for its stated scope, so any correct
   answer is accepted. Rarity tiers are curated estimates of how likely an
   average fan is to recall each answer, not live submission statistics.
   `near` holds short notes shown when a well-known wrong answer is entered.
   ========================================================================== */
const GRONK_DATA = {

  /* ---------- Teams: current franchise + historical names and aliases ---------- */
  teams: {
    ARI: { name: 'Arizona Cardinals', aliases: ['Cardinals', 'Cards', 'Arizona', 'ARI', 'ARZ', 'Phoenix', 'Phoenix Cardinals', 'St. Louis Cardinals', 'Chicago Cardinals'] },
    ATL: { name: 'Atlanta Falcons', aliases: ['Falcons', 'Atlanta', 'ATL', 'Dirty Birds'] },
    BAL: { name: 'Baltimore Ravens', aliases: ['Ravens', 'Baltimore', 'BAL'] },
    BUF: { name: 'Buffalo Bills', aliases: ['Bills', 'Buffalo', 'BUF'] },
    CAR: { name: 'Carolina Panthers', aliases: ['Panthers', 'Carolina', 'CAR'] },
    CHI: { name: 'Chicago Bears', aliases: ['Bears', 'Chicago', 'CHI', 'Da Bears', 'Monsters of the Midway', 'Decatur Staleys'] },
    CIN: { name: 'Cincinnati Bengals', aliases: ['Bengals', 'Cincinnati', 'Cincy', 'CIN'] },
    CLE: { name: 'Cleveland Browns', aliases: ['Browns', 'Cleveland', 'CLE'] },
    DAL: { name: 'Dallas Cowboys', aliases: ['Cowboys', 'Dallas', 'DAL', "America's Team"] },
    DEN: { name: 'Denver Broncos', aliases: ['Broncos', 'Denver', 'DEN'] },
    DET: { name: 'Detroit Lions', aliases: ['Lions', 'Detroit', 'DET', 'Portsmouth Spartans'] },
    GB:  { name: 'Green Bay Packers', aliases: ['Packers', 'Green Bay', 'GB', 'GNB', 'Pack'] },
    HOU: { name: 'Houston Texans', aliases: ['Texans', 'Houston', 'HOU'] },
    IND: { name: 'Indianapolis Colts', aliases: ['Colts', 'Indianapolis', 'Indy', 'IND', 'Baltimore Colts'] },
    JAX: { name: 'Jacksonville Jaguars', aliases: ['Jaguars', 'Jags', 'Jacksonville', 'JAX', 'JAC'] },
    KC:  { name: 'Kansas City Chiefs', aliases: ['Chiefs', 'Kansas City', 'KC', 'KAN', 'Dallas Texans'] },
    LV:  { name: 'Las Vegas Raiders', aliases: ['Raiders', 'Las Vegas', 'Vegas', 'LV', 'LVR', 'Oakland', 'Oakland Raiders', 'Los Angeles Raiders', 'LA Raiders', 'OAK'] },
    LAC: { name: 'Los Angeles Chargers', aliases: ['Chargers', 'LA Chargers', 'LAC', 'San Diego', 'San Diego Chargers', 'SD', 'SDG', 'Bolts'] },
    LAR: { name: 'Los Angeles Rams', aliases: ['Rams', 'LA Rams', 'LAR', 'St. Louis Rams', 'Cleveland Rams'] },
    MIA: { name: 'Miami Dolphins', aliases: ['Dolphins', 'Miami', 'MIA', 'Fins', 'Phins'] },
    MIN: { name: 'Minnesota Vikings', aliases: ['Vikings', 'Minnesota', 'MIN', 'Vikes'] },
    NE:  { name: 'New England Patriots', aliases: ['Patriots', 'Pats', 'New England', 'NE', 'NWE', 'Boston', 'Boston Patriots'] },
    NO:  { name: 'New Orleans Saints', aliases: ['Saints', 'New Orleans', 'NO', 'NOR', 'NOLA'] },
    NYG: { name: 'New York Giants', aliases: ['Giants', 'NY Giants', 'NYG', 'G-Men', 'Big Blue'] },
    NYJ: { name: 'New York Jets', aliases: ['Jets', 'NY Jets', 'NYJ', 'New York Titans', 'Gang Green'] },
    PHI: { name: 'Philadelphia Eagles', aliases: ['Eagles', 'Philadelphia', 'Philly', 'PHI'] },
    PIT: { name: 'Pittsburgh Steelers', aliases: ['Steelers', 'Pittsburgh', 'PIT'] },
    SF:  { name: 'San Francisco 49ers', aliases: ['49ers', 'Niners', 'Forty Niners', 'Forty-Niners', 'San Francisco', 'SF', 'SFO'] },
    SEA: { name: 'Seattle Seahawks', aliases: ['Seahawks', 'Hawks', 'Seattle', 'SEA'] },
    TB:  { name: 'Tampa Bay Buccaneers', aliases: ['Buccaneers', 'Bucs', 'Bucks', 'Tampa Bay', 'Tampa', 'TB', 'TAM'] },
    TEN: { name: 'Tennessee Titans', aliases: ['Titans', 'Tennessee', 'TEN', 'Oilers', 'Houston Oilers', 'Tennessee Oilers'] },
    WAS: { name: 'Washington Commanders', aliases: ['Commanders', 'Washington', 'WAS', 'WSH', 'Washington Football Team', 'Washington Redskins', 'Redskins'] }
  },
  // Names that could mean more than one franchise: always ask for clarification.
  teamAmbiguous: {
    'New York': ['NYG', 'NYJ'], 'NY': ['NYG', 'NYJ'],
    'Los Angeles': ['LAR', 'LAC'], 'LA': ['LAR', 'LAC'],
    'St. Louis': ['LAR', 'ARI'], 'STL': ['LAR', 'ARI']
  },

  /* ---------- Venues (host: false = recognized, but never hosted a Super Bowl) ---------- */
  venues: {
    superdome:     { name: 'Caesars Superdome', aliases: ['Superdome', 'Louisiana Superdome', 'Mercedes-Benz Superdome', 'New Orleans Superdome'] },
    hard_rock:     { name: 'Hard Rock Stadium', aliases: ['Hard Rock', 'Joe Robbie Stadium', 'Joe Robbie', 'Pro Player Stadium', 'Pro Player Park', 'Pro Player', 'Dolphins Stadium', 'Dolphin Stadium', 'Land Shark Stadium', 'Sun Life Stadium', 'Sun Life', 'New Miami Stadium'] },
    rose_bowl:     { name: 'Rose Bowl', aliases: ['Rose Bowl Stadium', 'Pasadena Rose Bowl'] },
    orange_bowl:   { name: 'Miami Orange Bowl', aliases: ['Orange Bowl', 'Burdine Stadium', 'Roddy Burdine Stadium'] },
    levis:         { name: "Levi's Stadium", aliases: ["Levi's", 'Levis Stadium'] },
    state_farm:    { name: 'State Farm Stadium', aliases: ['State Farm', 'University of Phoenix Stadium', 'Cardinals Stadium'] },
    raymond_james: { name: 'Raymond James Stadium', aliases: ['Raymond James', 'Ray Jay', 'Ray-Jay'] },
    sofi:          { name: 'SoFi Stadium', aliases: ['SoFi', 'So Fi Stadium'] },
    allegiant:     { name: 'Allegiant Stadium', aliases: ['Allegiant'] },
    mb_stadium:    { name: 'Mercedes-Benz Stadium', aliases: ['MBS'] },
    att:           { name: 'AT&T Stadium', aliases: ['AT&T', 'Cowboys Stadium', 'Dallas Cowboys Stadium', 'Jerry World', 'Jerryworld'] },
    metlife:       { name: 'MetLife Stadium', aliases: ['MetLife', 'Met Life Stadium', 'New Meadowlands Stadium', 'Meadowlands Stadium'] },
    nrg:           { name: 'NRG Stadium', aliases: ['NRG', 'Reliant Stadium', 'Reliant'] },
    us_bank:       { name: 'U.S. Bank Stadium', aliases: ['US Bank', 'U.S. Bank'] },
    lucas_oil:     { name: 'Lucas Oil Stadium', aliases: ['Lucas Oil'] },
    ford_field:    { name: 'Ford Field', aliases: [] },
    coliseum:      { name: 'Los Angeles Memorial Coliseum', aliases: ['LA Memorial Coliseum', 'Memorial Coliseum', 'LA Coliseum', 'Los Angeles Coliseum', 'Coliseum'] },
    qualcomm:      { name: 'Jack Murphy Stadium', display: 'Jack Murphy / Qualcomm Stadium', aliases: ['San Diego Jack Murphy Stadium', 'Jack Murphy', 'The Murph', 'Qualcomm Stadium', 'Qualcomm', 'San Diego Stadium', 'SDCCU Stadium'] },
    georgia_dome:  { name: 'Georgia Dome', aliases: [] },
    sun_devil:     { name: 'Sun Devil Stadium', aliases: [] },
    silverdome:    { name: 'Pontiac Silverdome', aliases: ['Silverdome'] },
    metrodome:     { name: 'Hubert H. Humphrey Metrodome', display: 'Metrodome', aliases: ['Metrodome', 'Humphrey Metrodome', 'HHH Metrodome', 'Minnesota Metrodome'] },
    tampa_stadium: { name: 'Tampa Stadium', aliases: ['Big Sombrero', "Houlihan's Stadium"] },
    stanford:      { name: 'Stanford Stadium', aliases: [] },
    tulane:        { name: 'Tulane Stadium', aliases: [] },
    alltel:        { name: 'Alltel Stadium', display: 'Alltel Stadium (now EverBank Stadium)', aliases: ['Alltel', 'EverBank Stadium', 'EverBank Field', 'EverBank', 'TIAA Bank Field', 'Jacksonville Municipal Stadium'] },
    rice_stadium:  { name: 'Rice Stadium', aliases: [] },
    lambeau:       { name: 'Lambeau Field', host: false, aliases: ['Lambeau'] },
    soldier:       { name: 'Soldier Field', host: false, aliases: [] },
    arrowhead:     { name: 'Arrowhead Stadium', host: false, aliases: ['Arrowhead', 'GEHA Field at Arrowhead Stadium'] },
    gillette:      { name: 'Gillette Stadium', host: false, aliases: ['Gillette'] },
    linc:          { name: 'Lincoln Financial Field', host: false, aliases: ['The Linc'] },
    lumen:         { name: 'Lumen Field', host: false, aliases: ['CenturyLink Field', 'Qwest Field'] },
    highmark:      { name: 'Highmark Stadium', host: false, aliases: ['Ralph Wilson Stadium', 'Rich Stadium', 'New Era Field'] },
    mt_bank:       { name: 'M&T Bank Stadium', host: false, aliases: [] },
    acrisure:      { name: 'Acrisure Stadium', host: false, aliases: ['Heinz Field'] },
    mile_high:     { name: 'Empower Field at Mile High', host: false, aliases: ['Empower Field', 'Mile High Stadium', 'Mile High', 'Invesco Field at Mile High', 'Sports Authority Field at Mile High'] },
    nissan:        { name: 'Nissan Stadium', host: false, aliases: ['LP Field', 'Adelphia Coliseum'] },
    boa:           { name: 'Bank of America Stadium', host: false, aliases: ['Ericsson Stadium'] },
    candlestick:   { name: 'Candlestick Park', host: false, aliases: ['Candlestick', '3Com Park', 'Monster Park'] },
    texas_stadium: { name: 'Texas Stadium', host: false, aliases: [] },
    giants_stad:   { name: 'Giants Stadium', host: false, aliases: [] },
    three_rivers:  { name: 'Three Rivers Stadium', host: false, aliases: [] },
    veterans:      { name: 'Veterans Stadium', host: false, aliases: ['The Vet'] },
    wembley:       { name: 'Wembley Stadium', host: false, aliases: ['Wembley'] },
    northwest:     { name: 'Northwest Stadium', host: false, aliases: ['FedExField', 'FedEx Field', 'Jack Kent Cooke Stadium'] },
    paycor:        { name: 'Paycor Stadium', host: false, aliases: ['Paul Brown Stadium'] },
    huntington:    { name: 'Huntington Bank Field', host: false, aliases: ['Cleveland Browns Stadium', 'FirstEnergy Stadium'] }
  },
  venueAmbiguous: { 'Mercedes-Benz': ['superdome', 'mb_stadium'] },

  /* ---------- Player nicknames and alternate names (must be unambiguous) ---------- */
  playerAliases: {
    'Tom Brady': ['TB12', 'Thomas Brady', 'Tommy Brady'],
    'Patrick Mahomes': ['Pat Mahomes', 'Patrick Mahomes II'],
    'Joe Montana': ['Joe Cool'],
    'Peyton Manning': ['Peyton', 'The Sheriff'],
    'Eli Manning': ['Eli'],
    'Aaron Rodgers': ['A-Rod', 'ARod'],
    'Kenneth Walker III': ['Ken Walker', 'Ken Walker III', 'KW3'],
    'Joe Namath': ['Broadway Joe'],
    'Roger Staubach': ['Roger the Dodger'],
    'John Riggins': ['Riggo', 'The Diesel'],
    'Larry Csonka': ['Zonk'],
    'Len Dawson': ['Lenny Dawson'],
    'Randy White': ['The Manster'],
    'Ottis Anderson': ['O.J. Anderson'],
    'Ken Stabler': ['Kenny Stabler', 'The Snake', 'Snake Stabler'],
    'Johnny Unitas': ['Johnny U', 'John Unitas'],
    'Russell Wilson': ['DangeRuss'],
    'Ben Roethlisberger': ['Big Ben'],
    'Matthew Stafford': ['Matt Stafford'],
    'Philip Rivers': ['Phillip Rivers'],
    'Dan Marino': ['Danny Marino'],
    'Derrick Henry': ['King Henry'],
    'Saquon Barkley': ['Saquon'],
    'Adrian Peterson': ['AP', 'All Day'],
    'O.J. Simpson': ['OJ', 'The Juice'],
    'Chris Johnson': ['CJ2K'],
    'Christian McCaffrey': ['CMC', 'Run CMC'],
    'LaDainian Tomlinson': ['LT'],
    'Ezekiel Elliott': ['Zeke', 'Zeke Elliott'],
    'James Cook': ['James Cook III'],
    'LeSean McCoy': ['Shady', 'Shady McCoy'],
    'Maurice Jones-Drew': ['MJD', 'Pocket Hercules'],
    'Edgerrin James': ['Edge', 'Edgerrin'],
    'Walter Payton': ['Sweetness'],
    'Jerome Bettis': ['The Bus'],
    'Terrell Owens': ['T.O.'],
    'Larry Fitzgerald': ['Fitz', 'Larry Fitzgerald Jr.'],
    'Cris Carter': ['Chris Carter'],
    'Marvin Harrison': ['Marvin Harrison Sr.'],
    'Tony Gonzalez': ['Tony G'],
    'Tyreek Hill': ['Cheetah'],
    'Jaxon Smith-Njigba': ['JSN'],
    'Calvin Johnson': ['Megatron'],
    'Antonio Brown': ['AB'],
    'Chad Johnson': ['Ochocinco', 'Chad Ochocinco', 'Ocho'],
    'Steve Smith Sr.': ['Agent 89'],
    'Josh Gordon': ['Flash Gordon'],
    'T.Y. Hilton': ['The Ghost'],
    'Dave Casper': ['The Ghost', 'Ghost Casper'],
    'Mike Ditka': ['Iron Mike', 'Da Coach'],
    'Kellen Winslow': ['Kellen Winslow Sr.'],
    'Kellen Winslow II': ['Kellen Winslow Jr.'],
    'Ozzie Newsome': ['Ozzie', 'The Wizard of Oz'],
    'Lawrence Taylor': ['LT'],
    'Reggie White': ['Minister of Defense', 'The Minister of Defense'],
    'Deion Sanders': ['Deion', 'Prime Time', 'Primetime', 'Neon Deion', 'Coach Prime'],
    'Joe Greene': ['Mean Joe Greene', 'Mean Joe'],
    'Mike Singletary': ['Samurai Mike'],
    'Patrick Surtain II': ['Pat Surtain', 'Pat Surtain II'],
    'James Harrison': ['Silverback'],
    'Terrell Suggs': ['T-Sizzle'],
    'Lee Roy Selmon': ['Leroy Selmon'],
    'Lester Hayes': ['The Judge'],
    'Kenny Easley': ['Ken Easley'],
    'Lamar Jackson': ['Lamar'],
    'Matt Ryan': ['Matty Ice'],
    'Steve McNair': ['Air McNair'],
    'Boomer Esiason': ['Norman Esiason'],
    'Fran Tarkenton': ['Francis Tarkenton', 'Scramblin Fran'],
    'Paul Hornung': ['The Golden Boy'],
    'Norm Van Brocklin': ['The Dutchman'],
    'Earl Campbell': ['The Tyler Rose'],
    'Todd Gurley': ['Todd Gurley II'],
    'Odell Beckham Jr.': ['OBJ', 'Odell'],
    'Dak Prescott': ['Dak'],
    'Robert Griffin III': ['RG3', 'RGIII'],
    'Cadillac Williams': ['Carnell Williams', 'Carnell Cadillac Williams'],
    'Anthony Thomas': ['A-Train'],
    'Sauce Gardner': ['Ahmad Gardner', 'Ahmad Sauce Gardner'],
    'Darius Leonard': ['Shaquille Leonard', 'Shaq Leonard'],
    'Jevon Kearse': ['The Freak'],
    'Shawne Merriman': ['Lights Out'],
    'Joe Burrow': ['Joey B', 'Joe Shiesty'],
    'Baker Mayfield': ['Baker'],
    'Cam Ward': ['Cameron Ward'],
    'Jameis Winston': ['Famous Jameis'],
    'Michael Vick': ['Mike Vick'],
    'Vinny Testaverde': ['Vinnie Testaverde', 'Vincent Testaverde'],
    'Bo Jackson': ['Bo'],
    'Jadeveon Clowney': ['JD Clowney'],
    'Ed "Too Tall" Jones': ['Too Tall Jones', 'Too Tall', 'Ed Jones'],
    'Bubba Smith': ['Charles Bubba Smith'],
    'Ki-Jana Carter': ['Kijana Carter'],
    'Dan Wilkinson': ['Big Daddy Wilkinson', 'Big Daddy'],
    'John Matuszak': ['The Tooz'],
    'Bill Belichick': ['The Hoodie'],
    'Andy Reid': ['Big Red'],
    'Bill Walsh': ['The Genius'],
    'Bill Parcells': ['Big Tuna', 'The Big Tuna'],
    'Jon Gruden': ['Chucky'],
    'Weeb Ewbank': ['Wilbur Ewbank'],
    'Mike Macdonald': ['Mike McDonald'],
    'Bud Grant': ['Harry Grant'],
    'Zac Taylor': ['Zach Taylor'],
    'Ron Rivera': ['Riverboat Ron'],
    'Forrest Gregg': ['Forest Gregg'],
    'Will Anderson Jr.': ['Will Anderson']
  },

  /* ---------- Well-known names outside the answer lists ----------
     They make surname-only answers ask for a first name, and stop typo
     tolerance from turning a real non-qualifying player into a qualifier. */
  extraPlayers: [
    'Marvin Harrison Jr.', 'Derek Carr', 'Dalvin Cook', 'Jahmyr Gibbs', 'Jarvis Landry', 'Brian Flores', 'Jay Gruden',
    'Reggie Bush', 'Ray Rice', 'Earl Thomas', 'Joe Thomas', 'Zach Thomas', 'Demaryius Thomas', 'Andre Reed', 'Sterling Sharpe',
    'Rob Gronkowski', 'Jimmy Graham', 'Don Hutson', 'Deacon Jones', 'Dick Butkus', 'DeSean Jackson', 'Vincent Jackson',
    'Rickey Jackson', 'Steven Jackson', 'Keith Jackson', 'Jim Kelly', 'Tony Dorsett', 'Marshawn Lynch', 'Puka Nacua',
    'Brock Bowers', 'Travis Hunter', 'Johnny Manziel', 'Tim Tebow', 'Chuck Bednarik', 'Patrick Peterson', 'Larry Allen',
    'Eric Allen', 'Keenan Allen', 'Darrelle Revis', 'Champ Bailey', 'Ronnie Lott', 'A.J. Brown', 'Troy Brown', 'Willie Brown',
    'Paul Brown', 'Amon-Ra St. Brown', 'Michael Irvin', 'Gale Sayers', 'Al Baker', 'Shaquil Barrett', 'Robert Mathis',
    'Dwight Freeney', 'Aidan Hutchinson', 'Brock Purdy', 'Drake Maye', 'Kirk Cousins', 'Rod Smith', 'DeVonta Smith',
    'Geno Smith', 'Gary Anderson', 'Morten Andersen', 'Jamal Anderson', 'Bob Hayes', 'Larry Johnson', 'David Johnson',
    'Aaron Jones', 'Daniel Jones', 'Chandler Jones', 'Sean Taylor', 'Fred Taylor', 'Charley Taylor', 'Dwight White',
    'Danny White', 'Kyren Williams', 'Aeneas Williams', 'Roy Williams', 'Kevin Williams', 'Larry Wilson', 'Zach Wilson',
    'Darren Woodson', 'Bryant Young', 'Marvin Lewis', 'Al Davis', 'Thomas Davis', 'Vernon Davis', 'Willie Davis',
    'Doug Martin', 'Rodney Harrison', 'Heath Miller', 'Shedeur Sanders', 'Emmanuel Sanders', 'Herschel Walker',
    'Mike Webster', 'Eddie Brown', 'Matt Hasselbeck', 'Kerry Collins', 'Rex Grossman', 'Colin Kaepernick',
    'Jake Delhomme', "Neil O'Donnell", 'Stan Humphries', 'Chris Chandler', 'Tony Eason', 'Vince Ferragamo',
    'Ron Jaworski', 'David Woodley', 'Billy Kilmer', 'Daryle Lamonica', 'Joe Kapp', 'Jimmy Garoppolo', 'Donovan McNabb',
    'Otto Graham', 'Randall Cunningham', 'Jack Ham', 'Jack Youngblood', 'Carl Eller', 'Merlin Olsen', 'Bob Lilly',
    'John Randle', 'Cameron Jordan', 'Sean McDermott', 'Joey Porter', 'Ty Law', 'Kevin Mawae'
  ],

  /* ---------- Questions ---------- */
  questions: [

    /* ===== SUPER BOWL HISTORY ===== */
    {
      id: 'superbowl_mvp', category: 'Super Bowl History', difficulty: 'easy', type: 'player',
      prompt: 'Name a player who has won Super Bowl MVP.',
      scope: 'Any Super Bowl, I through LX (1967–2026).',
      tiers: {
        chalk: ['Tom Brady', 'Patrick Mahomes', 'Joe Montana'],
        starter: ['Peyton Manning', 'Eli Manning', 'Jerry Rice', 'John Elway', 'Terry Bradshaw', 'Drew Brees', 'Aaron Rodgers', 'Jalen Hurts', 'Kenneth Walker III', 'Joe Namath', 'Bart Starr'],
        pro_bowler: ['Troy Aikman', 'Emmitt Smith', 'Steve Young', 'Kurt Warner', 'Ray Lewis', 'Von Miller', 'Nick Foles', 'Joe Flacco', 'Cooper Kupp', 'Julian Edelman', 'Roger Staubach', 'Franco Harris', 'Lynn Swann', 'Marcus Allen', 'Doug Williams'],
        all_pro: ['Terrell Davis', 'Desmond Howard', 'Hines Ward', 'Santonio Holmes', 'Phil Simms', 'Jim Plunkett', 'John Riggins', 'Larry Csonka', 'Len Dawson'],
        hall_of_famer: ['Dexter Jackson', 'Malcolm Smith', 'Deion Branch', 'Richard Dent', 'Mark Rypien', 'Fred Biletnikoff', 'Randy White'],
        gronkillion: ['Chuck Howley', 'Jake Scott', 'Harvey Martin', 'Ottis Anderson', 'Larry Brown']
      },
      near: {
        'Josh Allen': 'Josh Allen has never played in a Super Bowl.',
        'Dan Marino': 'Marino played in one Super Bowl (XIX) and lost.',
        'Lawrence Taylor': 'LT won two rings but never the Super Bowl MVP award.'
      }
    },
    {
      id: 'superbowl_winning_coach', category: 'Super Bowl History', difficulty: 'medium', type: 'player',
      prompt: 'Name a head coach who has won a Super Bowl.',
      scope: 'Any Super Bowl, I through LX.',
      tiers: {
        chalk: ['Bill Belichick', 'Andy Reid', 'Vince Lombardi'],
        starter: ['Bill Walsh', 'Tom Landry', 'Don Shula', 'Sean McVay', 'Pete Carroll', 'Sean Payton', 'Mike Tomlin', 'Tom Coughlin', 'Nick Sirianni', 'Mike Macdonald', 'Bill Parcells', 'Jimmy Johnson'],
        pro_bowler: ['Joe Gibbs', 'Chuck Noll', 'John Madden', 'Mike Ditka', 'Tony Dungy', 'Bill Cowher', 'John Harbaugh', 'Bruce Arians', 'Jon Gruden', 'Mike Shanahan', 'Doug Pederson', 'Mike McCarthy', 'Mike Holmgren'],
        all_pro: ['Dick Vermeil', 'Gary Kubiak', 'Brian Billick', 'George Seifert', 'Barry Switzer', 'Tom Flores'],
        hall_of_famer: ['Hank Stram', 'Weeb Ewbank'],
        gronkillion: ['Don McCafferty']
      },
      near: {
        'Kyle Shanahan': 'Kyle Shanahan has lost two Super Bowls as a head coach.',
        'Marv Levy': 'Levy lost four straight Super Bowls with Buffalo.',
        'Bud Grant': 'Grant went 0–4 in Super Bowls with Minnesota.',
        'Mike Vrabel': 'Vrabel won three rings as a player, but lost Super Bowl LX as a head coach.',
        'Jim Harbaugh': 'Jim lost Super Bowl XLVII to his brother John.',
        'Marty Schottenheimer': 'Schottenheimer never reached a Super Bowl.'
      }
    },
    {
      id: 'mvp_and_sb_mvp', category: 'Super Bowl History', difficulty: 'hard', type: 'player',
      prompt: 'Name a player who won AP NFL MVP and Super Bowl MVP for the same season.',
      scope: 'Both awards for the same season, through the 2025 season.',
      tiers: {
        chalk: ['Patrick Mahomes'],
        starter: ['Joe Montana'],
        pro_bowler: ['Kurt Warner', 'Steve Young'],
        all_pro: ['Terry Bradshaw'],
        hall_of_famer: ['Emmitt Smith'],
        gronkillion: ['Bart Starr']
      },
      near: {
        'Tom Brady': "Brady's MVP seasons (2007, 2010, 2017) didn't end with a Super Bowl win.",
        'Terrell Davis': 'Davis was Super Bowl MVP after 1997 and league MVP in 1998.',
        'Peyton Manning': "Peyton's Super Bowl MVP came in the 2006 season, when he wasn't league MVP."
      }
    },

    /* ===== QUARTERBACKS ===== */
    {
      id: 'qb_super_bowl_winners', category: 'Quarterbacks', difficulty: 'easy', type: 'player',
      prompt: 'Name a quarterback who started a Super Bowl win.',
      scope: 'Starting QB of the winning team, Super Bowls I–LX.',
      tiers: {
        chalk: ['Tom Brady', 'Patrick Mahomes', 'Joe Montana'],
        starter: ['Peyton Manning', 'Eli Manning', 'John Elway', 'Terry Bradshaw', 'Drew Brees', 'Aaron Rodgers', 'Troy Aikman', 'Jalen Hurts', 'Russell Wilson'],
        pro_bowler: ['Steve Young', 'Brett Favre', 'Kurt Warner', 'Ben Roethlisberger', 'Joe Flacco', 'Nick Foles', 'Matthew Stafford', 'Sam Darnold', 'Roger Staubach', 'Joe Namath'],
        all_pro: ['Bart Starr', 'Jim Plunkett', 'Phil Simms', 'Doug Williams', 'Trent Dilfer', 'Ken Stabler', 'Bob Griese', 'Joe Theismann', 'Jim McMahon', 'Len Dawson'],
        hall_of_famer: ['Brad Johnson', 'Mark Rypien', 'Johnny Unitas'],
        gronkillion: ['Jeff Hostetler']
      },
      near: {
        'Earl Morrall': 'Morrall finished Super Bowl V, but Johnny Unitas started it.',
        'Dan Marino': 'Marino started Super Bowl XIX and lost.',
        'Jim Kelly': 'Kelly started four straight Super Bowls and lost them all.',
        'Fran Tarkenton': 'Tarkenton started three Super Bowls and lost each one.'
      }
    },
    {
      id: 'qb_400_td', category: 'Quarterbacks', difficulty: 'medium', type: 'player',
      prompt: 'Name a quarterback with at least 400 career touchdown passes.',
      scope: 'Regular-season totals through the 2025 season.',
      tiers: {
        chalk: ['Tom Brady', 'Drew Brees', 'Peyton Manning'],
        starter: ['Brett Favre', 'Aaron Rodgers'],
        pro_bowler: ['Dan Marino'],
        all_pro: ['Ben Roethlisberger'],
        hall_of_famer: ['Philip Rivers'],
        gronkillion: ['Matthew Stafford']
      },
      near: {
        'Eli Manning': 'Eli finished with 366 touchdown passes.',
        'Matt Ryan': 'Matt Ryan finished with 381.',
        'John Elway': 'Elway threw 300.',
        'Fran Tarkenton': 'Tarkenton threw 342.',
        'Joe Montana': 'Montana threw 273.'
      }
    },
    {
      id: 'qb_two_franchises', category: 'Quarterbacks', difficulty: 'hard', type: 'player',
      prompt: 'Name a quarterback who started a Super Bowl for two different franchises.',
      scope: 'Super Bowls I–LX.',
      tiers: {
        chalk: ['Tom Brady'],
        starter: ['Peyton Manning'],
        all_pro: ['Kurt Warner'],
        gronkillion: ['Craig Morton']
      },
      near: {
        'Joe Montana': 'All four of Montana\'s Super Bowl starts came with San Francisco.',
        'Brett Favre': 'Both of Favre\'s Super Bowl starts came with Green Bay.',
        'John Elway': 'All five of Elway\'s Super Bowl starts came with Denver.',
        'Russell Wilson': 'Both of Wilson\'s Super Bowl starts came with Seattle.'
      }
    },

    /* ===== RUNNING BACKS ===== */
    {
      id: 'rb_2000_season', category: 'Running Backs', difficulty: 'medium', type: 'player',
      prompt: 'Name a running back who rushed for 2,000+ yards in a single season.',
      scope: 'Regular season, through the 2025 season.',
      tiers: {
        chalk: ['Derrick Henry', 'Saquon Barkley'],
        starter: ['Barry Sanders', 'Adrian Peterson', 'Eric Dickerson'],
        pro_bowler: ['O.J. Simpson'],
        all_pro: ['Terrell Davis', 'Chris Johnson'],
        gronkillion: ['Jamal Lewis']
      },
      near: {
        'Earl Campbell': "Campbell's best season was 1,934 yards in 1980.",
        'Walter Payton': "Payton's best season was 1,852 yards in 1977.",
        'Emmitt Smith': "Emmitt's best season was 1,773 yards in 1995.",
        'LaDainian Tomlinson': "LT's best season was 1,815 yards in 2006.",
        'Jim Brown': "Jim Brown's best season was 1,863 yards in 1963."
      }
    },
    {
      id: 'rb_rushing_champs', category: 'Running Backs', difficulty: 'medium', type: 'player',
      prompt: 'Name a player who led the NFL in rushing yards in a season from 2000 to 2025.',
      scope: 'Regular-season rushing-yards leaders, 2000–2025.',
      tiers: {
        chalk: ['Saquon Barkley', 'Derrick Henry'],
        starter: ['Christian McCaffrey', 'Adrian Peterson', 'LaDainian Tomlinson', 'Ezekiel Elliott', 'Jonathan Taylor'],
        pro_bowler: ['Josh Jacobs', 'James Cook', 'Chris Johnson', 'Shaun Alexander', 'LeSean McCoy'],
        all_pro: ['Jamal Lewis', 'DeMarco Murray', 'Maurice Jones-Drew', 'Arian Foster', 'Kareem Hunt', 'Edgerrin James', 'Ricky Williams'],
        hall_of_famer: ['Priest Holmes'],
        gronkillion: ['Curtis Martin']
      },
      near: {
        'Marshawn Lynch': 'Beast Mode never led the league in rushing yards.',
        'Frank Gore': 'Gore never led the league in rushing yards.'
      }
    },
    {
      id: 'rb_13000_career', category: 'Running Backs', difficulty: 'hard', type: 'player',
      prompt: 'Name a player with at least 13,000 career rushing yards.',
      scope: 'Regular-season totals through the 2025 season.',
      tiers: {
        chalk: ['Emmitt Smith', 'Walter Payton', 'Barry Sanders'],
        starter: ['Adrian Peterson', 'LaDainian Tomlinson'],
        pro_bowler: ['Frank Gore', 'Jerome Bettis'],
        all_pro: ['Eric Dickerson', 'Derrick Henry'],
        gronkillion: ['Curtis Martin']
      },
      near: {
        'Jim Brown': 'Jim Brown finished with 12,312 rushing yards.',
        'Tony Dorsett': 'Dorsett finished with 12,739 rushing yards.'
      }
    },

    /* ===== WIDE RECEIVERS ===== */
    {
      id: 'wr_100_rec_td', category: 'Wide Receivers', difficulty: 'medium', type: 'player',
      prompt: 'Name a player with at least 100 career receiving touchdowns.',
      scope: 'Regular-season totals through the 2025 season.',
      tiers: {
        chalk: ['Jerry Rice', 'Randy Moss'],
        starter: ['Terrell Owens', 'Larry Fitzgerald'],
        pro_bowler: ['Cris Carter', 'Marvin Harrison', 'Davante Adams'],
        all_pro: ['Tony Gonzalez', 'Antonio Gates', 'Mike Evans'],
        hall_of_famer: ['Tim Brown'],
        gronkillion: ['Steve Largent']
      },
      near: {
        'Don Hutson': 'Hutson finished with 99 receiving touchdowns, one short.',
        'Rob Gronkowski': 'Gronk finished with 92 receiving touchdowns.',
        'Calvin Johnson': 'Megatron finished with 83 receiving touchdowns.'
      }
    },
    {
      id: 'wr_yards_champs', category: 'Wide Receivers', difficulty: 'medium', type: 'player',
      prompt: 'Name a player who led the NFL in receiving yards in a season from 2000 to 2025.',
      scope: 'Regular-season receiving-yards leaders, 2000–2025.',
      tiers: {
        chalk: ["Ja'Marr Chase", 'Justin Jefferson', 'Tyreek Hill'],
        starter: ['Jaxon Smith-Njigba', 'Cooper Kupp', 'Calvin Johnson', 'Antonio Brown', 'Julio Jones'],
        pro_bowler: ['Michael Thomas', 'Stefon Diggs', 'Andre Johnson', 'Chad Johnson'],
        all_pro: ['Marvin Harrison', 'Reggie Wayne', 'Steve Smith Sr.', 'Torry Holt', 'Josh Gordon'],
        hall_of_famer: ['T.Y. Hilton'],
        gronkillion: ['Brandon Lloyd', 'Muhsin Muhammad', 'David Boston']
      },
      near: {
        'Randy Moss': 'Moss never led the league in receiving yards.',
        'Larry Fitzgerald': 'Fitzgerald never led the league in receiving yards.',
        'Puka Nacua': "Nacua's 1,715 yards in 2025 ranked second."
      }
    },
    {
      id: 'wr_super_bowl_mvp', category: 'Wide Receivers', difficulty: 'hard', type: 'player',
      prompt: 'Name a wide receiver who won Super Bowl MVP.',
      scope: 'Super Bowls I–LX. Players listed at wide receiver.',
      tiers: {
        starter: ['Jerry Rice'],
        pro_bowler: ['Julian Edelman', 'Cooper Kupp', 'Lynn Swann'],
        all_pro: ['Hines Ward', 'Desmond Howard', 'Santonio Holmes'],
        hall_of_famer: ['Deion Branch'],
        gronkillion: ['Fred Biletnikoff']
      },
      near: {
        'Randy Moss': 'Moss never won a Super Bowl.',
        'Michael Irvin': 'Irvin won three rings but never the MVP award.'
      }
    },

    /* ===== TIGHT ENDS ===== */
    {
      id: 'te_hall_of_fame', category: 'Tight Ends', difficulty: 'medium', type: 'player',
      prompt: 'Name a tight end enshrined in the Pro Football Hall of Fame.',
      scope: 'Inducted as tight ends, through the Class of 2026.',
      tiers: {
        chalk: ['Tony Gonzalez'],
        starter: ['Shannon Sharpe', 'Mike Ditka', 'Antonio Gates'],
        pro_bowler: ['Kellen Winslow', 'Ozzie Newsome'],
        all_pro: ['John Mackey'],
        hall_of_famer: ['Dave Casper', 'Jackie Smith'],
        gronkillion: ['Charlie Sanders']
      },
      near: {
        'Rob Gronkowski': 'Gronk first becomes eligible with the Class of 2027.',
        'Jason Witten': 'Witten was a finalist for the Class of 2026 but was not selected.'
      }
    },
    {
      id: 'te_six_pro_bowls', category: 'Tight Ends', difficulty: 'hard', type: 'player',
      prompt: 'Name a tight end selected to at least six Pro Bowls.',
      scope: 'Pro Bowl selections through the 2025 season.',
      tiers: {
        chalk: ['Tony Gonzalez', 'Travis Kelce'],
        starter: ['Jason Witten', 'George Kittle'],
        pro_bowler: ['Antonio Gates', 'Shannon Sharpe'],
        hall_of_famer: ['Charlie Sanders'],
        gronkillion: ['Steve Jordan']
      },
      near: {
        'Rob Gronkowski': 'Gronk made five Pro Bowls, one short of six.',
        'Jimmy Graham': 'Graham made five Pro Bowls.',
        'Mike Ditka': 'Ditka made five Pro Bowls.'
      }
    },
    {
      id: 'te_10000_yards', category: 'Tight Ends', difficulty: 'medium', type: 'player',
      prompt: 'Name a tight end with at least 10,000 career receiving yards.',
      scope: 'Regular-season totals through the 2025 season.',
      tiers: {
        chalk: ['Travis Kelce', 'Tony Gonzalez'],
        starter: ['Jason Witten'],
        all_pro: ['Antonio Gates'],
        gronkillion: ['Shannon Sharpe']
      },
      near: {
        'Rob Gronkowski': 'Gronk finished with 9,286 receiving yards.',
        'Ozzie Newsome': 'Newsome finished with 7,980 receiving yards.'
      }
    },

    /* ===== NFL FRANCHISES ===== */
    {
      id: 'franchise_never_won', category: 'NFL Franchises', difficulty: 'easy', type: 'team',
      prompt: 'Name a current NFL franchise that has never won a Super Bowl.',
      scope: 'Through Super Bowl LX. Earlier cities and names count as the same franchise.',
      tiers: {
        chalk: ['Detroit Lions', 'Cleveland Browns', 'Buffalo Bills'],
        starter: ['Minnesota Vikings', 'Cincinnati Bengals', 'Houston Texans', 'Jacksonville Jaguars'],
        pro_bowler: ['Atlanta Falcons', 'Carolina Panthers'],
        all_pro: ['Los Angeles Chargers'],
        hall_of_famer: ['Tennessee Titans'],
        gronkillion: ['Arizona Cardinals']
      },
      near: {
        'New York Jets': 'The Jets won Super Bowl III.',
        'New Orleans Saints': 'The Saints won Super Bowl XLIV.',
        'Chicago Bears': 'The Bears won Super Bowl XX.'
      }
    },
    {
      id: 'franchise_lost_never_won', category: 'NFL Franchises', difficulty: 'medium', type: 'team',
      prompt: 'Name a franchise that has played in a Super Bowl but never won one.',
      scope: 'Through Super Bowl LX.',
      tiers: {
        chalk: ['Buffalo Bills'],
        starter: ['Minnesota Vikings'],
        pro_bowler: ['Cincinnati Bengals', 'Atlanta Falcons', 'Carolina Panthers'],
        all_pro: ['Arizona Cardinals'],
        hall_of_famer: ['Tennessee Titans'],
        gronkillion: ['Los Angeles Chargers']
      },
      near: {
        'Detroit Lions': 'The Lions have never reached a Super Bowl.',
        'Cleveland Browns': 'The Browns have never reached a Super Bowl.',
        'Houston Texans': 'The Texans have never reached a Super Bowl.',
        'Jacksonville Jaguars': 'The Jaguars have never reached a Super Bowl.'
      }
    },
    {
      id: 'franchise_multi_sb', category: 'NFL Franchises', difficulty: 'easy', type: 'team',
      prompt: 'Name a franchise that has won at least two Super Bowls.',
      scope: 'Through Super Bowl LX. Titles won in earlier cities count.',
      tiers: {
        chalk: ['Pittsburgh Steelers', 'New England Patriots', 'Dallas Cowboys', 'San Francisco 49ers'],
        starter: ['Green Bay Packers', 'Kansas City Chiefs', 'New York Giants', 'Philadelphia Eagles', 'Seattle Seahawks'],
        pro_bowler: ['Denver Broncos', 'Tampa Bay Buccaneers', 'Los Angeles Rams', 'Baltimore Ravens'],
        all_pro: ['Miami Dolphins', 'Las Vegas Raiders'],
        hall_of_famer: ['Washington Commanders'],
        gronkillion: ['Indianapolis Colts']
      },
      near: {
        'New York Jets': 'The Jets have one Super Bowl win (III).',
        'Chicago Bears': 'The Bears have one Super Bowl win (XX).',
        'New Orleans Saints': 'The Saints have one Super Bowl win (XLIV).'
      }
    },
    {
      id: 'franchise_afl', category: 'NFL Franchises', difficulty: 'hard', type: 'team',
      prompt: 'Name a current NFL franchise that played in the AFL (1960–1969).',
      scope: 'Any AFL season, under any city or team name.',
      tiers: {
        chalk: ['New York Jets', 'Kansas City Chiefs'],
        starter: ['Las Vegas Raiders', 'Buffalo Bills', 'Denver Broncos'],
        pro_bowler: ['New England Patriots', 'Los Angeles Chargers'],
        all_pro: ['Miami Dolphins'],
        hall_of_famer: ['Tennessee Titans'],
        gronkillion: ['Cincinnati Bengals']
      },
      near: {
        'Pittsburgh Steelers': 'The Steelers moved from the NFL to the AFC in 1970, but never played in the AFL.',
        'Baltimore Ravens': 'The Ravens began play in 1996.',
        'Indianapolis Colts': 'The Colts (then in Baltimore) joined the AFC in 1970 from the NFL.',
        'Cleveland Browns': 'The Browns moved from the NFL to the AFC in 1970.'
      }
    },

    /* ===== DEFENSIVE LEGENDS ===== */
    {
      id: 'def_dpoy', category: 'Defensive Legends', difficulty: 'medium', type: 'player',
      prompt: 'Name a player who has won AP Defensive Player of the Year.',
      scope: '1971–2025 seasons.',
      tiers: {
        chalk: ['Aaron Donald', 'J.J. Watt', 'Myles Garrett', 'Lawrence Taylor'],
        starter: ['Reggie White', 'Ray Lewis', 'T.J. Watt', 'Deion Sanders', 'Ed Reed', 'Troy Polamalu'],
        pro_bowler: ['Michael Strahan', 'Khalil Mack', 'Nick Bosa', 'Luke Kuechly', 'Brian Urlacher', 'Charles Woodson', 'Bruce Smith', 'Joe Greene', 'Mike Singletary', 'Patrick Surtain II'],
        all_pro: ['Stephon Gilmore', 'James Harrison', 'Jason Taylor', 'Derrick Brooks', 'Warren Sapp', 'Terrell Suggs', 'Rod Woodson', 'Jack Lambert', 'Mel Blount', 'Alan Page'],
        hall_of_famer: ['Bob Sanders', 'Cortez Kennedy', 'Lee Roy Selmon', 'Lester Hayes', 'Randy Gradishar', 'Kenny Easley', 'Pat Swilling', 'Harvey Martin'],
        gronkillion: ['Bryce Paup', 'Dana Stubblefield', 'Keith Millard', 'Doug Betters', 'Dick Anderson']
      },
      near: {
        'Von Miller': 'Von Miller never won Defensive Player of the Year.',
        'Micah Parsons': 'Parsons has not won Defensive Player of the Year (through 2025).',
        'Julius Peppers': 'Peppers never won Defensive Player of the Year.',
        'Dick Butkus': "AP's award began in 1971, and Butkus never won it."
      }
    },
    {
      id: 'def_20_sack_season', category: 'Defensive Legends', difficulty: 'hard', type: 'player',
      prompt: 'Name a player with at least 20 sacks in a single season.',
      scope: 'Official sacks (tracked since 1982), regular season, through 2025.',
      tiers: {
        chalk: ['Myles Garrett'],
        starter: ['T.J. Watt', 'J.J. Watt', 'Aaron Donald', 'Michael Strahan'],
        pro_bowler: ['Reggie White', 'Lawrence Taylor'],
        all_pro: ['Jared Allen', 'DeMarcus Ware', 'Derrick Thomas'],
        hall_of_famer: ['Justin Houston', 'Mark Gastineau'],
        gronkillion: ['Chris Doleman']
      },
      near: {
        'Bruce Smith': "Bruce Smith's best season was 19 sacks in 1990.",
        'Deacon Jones': 'Deacon Jones played before sacks became an official stat.',
        'Shaquil Barrett': 'Barrett had 19.5 sacks in 2019.',
        'Al Baker': "Al Baker's 23 in 1978 came before sacks were official."
      }
    },
    {
      id: 'def_150_sacks', category: 'Defensive Legends', difficulty: 'hard', type: 'player',
      prompt: 'Name a player with at least 150 career sacks.',
      scope: 'Official sacks (tracked since 1982), regular-season totals.',
      tiers: {
        starter: ['Reggie White', 'Bruce Smith'],
        all_pro: ['Julius Peppers'],
        hall_of_famer: ['Kevin Greene'],
        gronkillion: ['Chris Doleman']
      },
      near: {
        'Michael Strahan': 'Strahan finished with 141.5 sacks.',
        'Deacon Jones': 'Deacon Jones played before sacks became an official stat.',
        'Lawrence Taylor': 'LT has 132.5 official sacks.',
        'DeMarcus Ware': 'Ware finished with 138.5 sacks.',
        'Jason Taylor': 'Jason Taylor finished with 139.5 sacks.'
      }
    },
    {
      id: 'def_super_bowl_mvp', category: 'Defensive Legends', difficulty: 'hard', type: 'player',
      prompt: 'Name a defensive player who won Super Bowl MVP.',
      scope: 'Super Bowls I–LX.',
      tiers: {
        chalk: ['Ray Lewis'],
        starter: ['Von Miller'],
        pro_bowler: ['Malcolm Smith'],
        all_pro: ['Richard Dent', 'Dexter Jackson', 'Randy White'],
        hall_of_famer: ['Larry Brown', 'Harvey Martin'],
        gronkillion: ['Jake Scott', 'Chuck Howley']
      },
      near: {
        'Desmond Howard': 'Desmond Howard won Super Bowl XXXI MVP as a kick returner, not a defender.',
        'Lawrence Taylor': 'LT never won Super Bowl MVP.'
      }
    },

    /* ===== NFL AWARDS ===== */
    {
      id: 'award_mvp', category: 'NFL Awards', difficulty: 'easy', type: 'player',
      prompt: 'Name a player who has won AP NFL MVP.',
      scope: '1957–2025 seasons. Co-winners count.',
      tiers: {
        chalk: ['Tom Brady', 'Patrick Mahomes', 'Peyton Manning', 'Aaron Rodgers'],
        starter: ['Lamar Jackson', 'Josh Allen', 'Matthew Stafford', 'Joe Montana', 'Brett Favre', 'John Elway', 'Dan Marino', 'Steve Young', 'Kurt Warner', 'Cam Newton', 'Adrian Peterson', 'Barry Sanders', 'Emmitt Smith', 'LaDainian Tomlinson', 'Jim Brown'],
        pro_bowler: ['Matt Ryan', 'Shaun Alexander', 'Marshall Faulk', 'Terrell Davis', 'Walter Payton', 'Marcus Allen', 'Lawrence Taylor', 'Johnny Unitas', 'Bart Starr', 'Terry Bradshaw', 'O.J. Simpson', 'Earl Campbell'],
        all_pro: ['Rich Gannon', 'Steve McNair', 'Boomer Esiason', 'Thurman Thomas', 'Joe Theismann', 'Ken Stabler', 'Fran Tarkenton', 'Paul Hornung', 'Alan Page'],
        hall_of_famer: ['Ken Anderson', 'Brian Sipe', 'Bert Jones', 'Mark Moseley', 'Y.A. Tittle', 'Norm Van Brocklin', 'Jim Taylor'],
        gronkillion: ['Earl Morrall', 'Roman Gabriel', 'John Brodie', 'Larry Brown']
      },
      near: {
        'Jerry Rice': 'Jerry Rice never won AP MVP.',
        'Christian McCaffrey': 'McCaffrey has not won AP MVP.',
        'Drew Brees': 'Brees never won AP MVP.'
      }
    },
    {
      id: 'award_mvp_non_qb', category: 'NFL Awards', difficulty: 'hard', type: 'player',
      prompt: 'Name a non-quarterback who has won AP NFL MVP.',
      scope: '1957–2025 seasons.',
      tiers: {
        chalk: ['Adrian Peterson', 'Barry Sanders'],
        starter: ['LaDainian Tomlinson', 'Emmitt Smith', 'Jim Brown', 'Walter Payton', 'Lawrence Taylor'],
        pro_bowler: ['Marshall Faulk', 'Shaun Alexander', 'Terrell Davis', 'Marcus Allen', 'O.J. Simpson', 'Earl Campbell'],
        all_pro: ['Thurman Thomas', 'Paul Hornung', 'Alan Page'],
        hall_of_famer: ['Mark Moseley', 'Jim Taylor'],
        gronkillion: ['Larry Brown']
      },
      near: {
        'Jerry Rice': 'Jerry Rice never won AP MVP.',
        'Christian McCaffrey': 'McCaffrey has not won AP MVP.',
        'Derrick Henry': 'Henry has not won AP MVP.',
        'Saquon Barkley': 'Barkley has not won AP MVP.',
        'Reggie White': 'Reggie White never won AP MVP.'
      }
    },
    {
      id: 'award_opoy', category: 'NFL Awards', difficulty: 'medium', type: 'player',
      prompt: 'Name a player who has won AP Offensive Player of the Year.',
      scope: '1972–2025 seasons.',
      tiers: {
        chalk: ['Tom Brady', 'Patrick Mahomes', 'Peyton Manning', 'Saquon Barkley', 'Christian McCaffrey'],
        starter: ['Derrick Henry', 'Justin Jefferson', 'Cooper Kupp', 'Jaxon Smith-Njigba', 'Jerry Rice', 'Barry Sanders', 'Drew Brees', 'Adrian Peterson', 'LaDainian Tomlinson', 'Joe Montana'],
        pro_bowler: ['Michael Thomas', 'Todd Gurley', 'Matt Ryan', 'Cam Newton', 'Marshall Faulk', 'Terrell Davis', 'Brett Favre', 'Steve Young', 'Dan Marino', 'Walter Payton', 'Earl Campbell', 'Eric Dickerson', 'Chris Johnson', 'Shaun Alexander'],
        all_pro: ['DeMarco Murray', 'Jamal Lewis', 'Priest Holmes', 'Thurman Thomas', 'Warren Moon', 'Marcus Allen', 'Roger Craig', 'O.J. Simpson'],
        hall_of_famer: ['Dan Fouts', 'Joe Theismann', 'Ken Stabler', 'Fran Tarkenton', 'Ken Anderson'],
        gronkillion: ['Bert Jones', 'Larry Brown']
      },
      near: {
        'Lamar Jackson': 'Lamar has two MVPs but has not won Offensive Player of the Year.',
        'Josh Allen': 'Josh Allen has not won Offensive Player of the Year.',
        'Randy Moss': 'Moss never won Offensive Player of the Year.'
      }
    },
    {
      id: 'award_oroy', category: 'NFL Awards', difficulty: 'medium', type: 'player',
      prompt: 'Name a player who won AP Offensive Rookie of the Year from 1990 to 2025.',
      scope: '1990–2025 seasons.',
      tiers: {
        chalk: ['Saquon Barkley', 'Randy Moss', 'Adrian Peterson'],
        starter: ['Jayden Daniels', 'C.J. Stroud', "Ja'Marr Chase", 'Justin Herbert', 'Odell Beckham Jr.', 'Dak Prescott', 'Emmitt Smith', 'Cam Newton', 'Kyler Murray'],
        pro_bowler: ['Tetairoa McMillan', 'Garrett Wilson', 'Alvin Kamara', 'Todd Gurley', 'Marshall Faulk', 'Ben Roethlisberger', 'Matt Ryan', 'Robert Griffin III', 'Jerome Bettis', 'Edgerrin James'],
        all_pro: ['Sam Bradford', 'Vince Young', 'Eddie George', 'Curtis Martin', 'Clinton Portis', 'Anquan Boldin', 'Eddie Lacy', 'Percy Harvin'],
        hall_of_famer: ['Warrick Dunn', 'Cadillac Williams', 'Mike Anderson', 'Carl Pickens'],
        gronkillion: ['Anthony Thomas', 'Leonard Russell']
      },
      near: {
        'Justin Jefferson': 'Jefferson never won Offensive Rookie of the Year.',
        'Puka Nacua': 'Nacua did not win Offensive Rookie of the Year.',
        'Brock Bowers': 'Bowers did not win Offensive Rookie of the Year.',
        'Peyton Manning': 'Peyton did not win Offensive Rookie of the Year.',
        'Barry Sanders': 'Barry won in 1989, one year before this window.'
      }
    },
    {
      id: 'award_droy', category: 'NFL Awards', difficulty: 'hard', type: 'player',
      prompt: 'Name a player who won AP Defensive Rookie of the Year from 1990 to 2025.',
      scope: '1990–2025 seasons.',
      tiers: {
        chalk: ['Aaron Donald', 'Micah Parsons', 'Von Miller'],
        starter: ['Nick Bosa', 'Joey Bosa', 'Luke Kuechly', 'Charles Woodson', 'Sauce Gardner', 'Brian Urlacher', 'Julius Peppers'],
        pro_bowler: ['Patrick Willis', 'Ndamukong Suh', 'Terrell Suggs', 'Chase Young', 'Will Anderson Jr.', 'Marcus Peters', 'Jared Verse', 'Marshon Lattimore', 'Darius Leonard'],
        all_pro: ['Carson Schwesinger', 'Jevon Kearse', 'Shawne Merriman', 'DeMeco Ryans', 'Jerod Mayo', 'Sheldon Richardson', 'Simeon Rice', 'Jonathan Vilma', 'Brian Cushing'],
        hall_of_famer: ['Dana Stubblefield', 'Hugh Douglas', 'Peter Boulware', 'Kendrell Bell', 'Mark Carrier'],
        gronkillion: ['Mike Croel', 'Tim Bowens', 'Dale Carter']
      },
      near: {
        'Lawrence Taylor': 'LT won in 1981, before this window.',
        'Derrick Thomas': 'Derrick Thomas won in 1989, one year before this window.',
        'Myles Garrett': 'Garrett did not win Defensive Rookie of the Year.',
        'Ed Reed': 'Ed Reed did not win Defensive Rookie of the Year.'
      }
    },

    /* ===== NFL DRAFT ===== */
    {
      id: 'draft_qb_first_overall', category: 'NFL Draft', difficulty: 'medium', type: 'player',
      prompt: 'Name a quarterback drafted first overall since 1967.',
      scope: 'NFL Drafts 1967–2026. Supplemental drafts don\'t count.',
      tiers: {
        chalk: ['Peyton Manning', 'Joe Burrow', 'John Elway'],
        starter: ['Trevor Lawrence', 'Caleb Williams', 'Baker Mayfield', 'Kyler Murray', 'Andrew Luck', 'Cam Newton', 'Troy Aikman', 'Eli Manning', 'Matthew Stafford'],
        pro_bowler: ['Jared Goff', 'Bryce Young', 'Cam Ward', 'Fernando Mendoza', 'Jameis Winston', 'Michael Vick', 'Terry Bradshaw'],
        all_pro: ['Drew Bledsoe', 'Carson Palmer', 'Alex Smith', 'JaMarcus Russell', 'Sam Bradford'],
        hall_of_famer: ['Tim Couch', 'David Carr', 'Vinny Testaverde', 'Jim Plunkett'],
        gronkillion: ['Jeff George', 'Steve Bartkowski']
      },
      near: {
        'Tom Brady': 'Brady went 199th overall in 2000.',
        'Steve Young': 'Young went first in the 1984 supplemental draft, which doesn\'t count here.',
        'Patrick Mahomes': 'Mahomes went 10th overall in 2017.',
        'Josh Allen': 'Josh Allen went 7th overall in 2018.',
        'Dan Marino': 'Marino went 27th overall in 1983.',
        'Aaron Rodgers': 'Rodgers went 24th overall in 2005.'
      }
    },
    {
      id: 'draft_non_qb_first_overall', category: 'NFL Draft', difficulty: 'hard', type: 'player',
      prompt: 'Name a non-quarterback drafted first overall since 1967.',
      scope: 'NFL Drafts 1967–2026.',
      tiers: {
        chalk: ['Myles Garrett'],
        starter: ['Bo Jackson', 'Bruce Smith', 'Earl Campbell', 'O.J. Simpson'],
        pro_bowler: ['Jadeveon Clowney', 'Orlando Pace', 'Keyshawn Johnson', 'Lee Roy Selmon', 'Mario Williams', 'Travon Walker'],
        all_pro: ['Ed "Too Tall" Jones', 'Bubba Smith', 'Jake Long', 'Eric Fisher', 'Irving Fryar', 'Ki-Jana Carter', 'Courtney Brown', 'Billy Sims'],
        hall_of_famer: ['Ron Yary', 'George Rogers', 'Russell Maryland', 'Steve Emtman', 'Dan Wilkinson', 'Ricky Bell'],
        gronkillion: ['Walt Patulski', 'John Matuszak', 'Tom Cousineau', 'Kenneth Sims', 'Aundray Bruce']
      },
      near: {
        'Reggie Bush': 'Bush went second overall in 2006.',
        'Chuck Bednarik': 'Bednarik went first in 1949, before this window.',
        'Barry Sanders': 'Barry Sanders went third overall in 1989.',
        'Lawrence Taylor': 'LT went second overall in 1981.'
      }
    },
    {
      id: 'draft_heisman_first_overall', category: 'NFL Draft', difficulty: 'hard', type: 'player',
      prompt: 'Name a Heisman Trophy winner who was drafted first overall since 1967.',
      scope: 'NFL Drafts 1967–2026.',
      tiers: {
        chalk: ['Joe Burrow'],
        starter: ['Baker Mayfield', 'Kyler Murray', 'Caleb Williams', 'Cam Newton', 'Bo Jackson'],
        pro_bowler: ['Bryce Young', 'Fernando Mendoza', 'Earl Campbell', 'Jameis Winston', 'O.J. Simpson'],
        all_pro: ['Carson Palmer', 'Sam Bradford', 'Vinny Testaverde', 'Jim Plunkett'],
        hall_of_famer: ['Billy Sims'],
        gronkillion: ['George Rogers']
      },
      near: {
        'Travis Hunter': 'Hunter went second overall in 2025.',
        'Jayden Daniels': 'Daniels went second overall in 2024.',
        'Barry Sanders': 'Barry Sanders went third overall in 1989.',
        'Lamar Jackson': 'Lamar went 32nd overall in 2018.',
        'Tim Tebow': 'Tebow went 25th overall in 2010.',
        'Johnny Manziel': 'Manziel went 22nd overall in 2014.'
      }
    },
    {
      id: 'draft_host_cities', category: 'NFL Draft', difficulty: 'medium', type: 'custom',
      prompt: 'Name a city that hosted the NFL Draft in person from 2015 through 2026.',
      scope: 'In-person drafts, 2015–2026. The 2020 draft was held virtually.',
      entities: {
        'Pittsburgh': ['Pittsburgh PA', 'Pittsburgh Pennsylvania'],
        'Green Bay': ['Green Bay WI', 'Green Bay Wisconsin'],
        'Detroit': ['Detroit MI', 'Detroit Michigan', 'Motor City'],
        'Las Vegas': ['Vegas', 'Las Vegas NV', 'Sin City'],
        'Kansas City': ['KC', 'Kansas City MO', 'Kansas City Missouri'],
        'Nashville': ['Nashville TN', 'Nashville Tennessee', 'Music City'],
        'Philadelphia': ['Philly', 'Philadelphia PA'],
        'Chicago': ['Chicago IL', 'Chi-Town', 'Windy City'],
        'Cleveland': ['Cleveland OH', 'Cleveland Ohio'],
        'Arlington': ['Arlington Texas', 'Arlington TX', 'Dallas', 'Dallas-Fort Worth', 'DFW', 'AT&T Stadium']
      },
      decoys: {
        'New York': { aliases: ['NYC', 'New York City', 'Radio City', 'Radio City Music Hall', 'Manhattan'], note: 'New York hosted every draft through 2014.' }
      },
      tiers: {
        starter: ['Pittsburgh', 'Green Bay', 'Detroit'],
        pro_bowler: ['Las Vegas', 'Kansas City', 'Nashville'],
        all_pro: ['Philadelphia', 'Chicago'],
        hall_of_famer: ['Arlington'],
        gronkillion: ['Cleveland']
      }
    },

    /* ===== NFL RECORDS ===== */
    {
      id: 'record_5000_season', category: 'NFL Records', difficulty: 'medium', type: 'player',
      prompt: 'Name a quarterback who passed for at least 5,000 yards in a single season.',
      scope: 'Regular season, through the 2025 season.',
      tiers: {
        chalk: ['Drew Brees', 'Tom Brady', 'Patrick Mahomes'],
        starter: ['Peyton Manning'],
        pro_bowler: ['Dan Marino'],
        all_pro: ['Ben Roethlisberger', 'Justin Herbert', 'Matthew Stafford'],
        gronkillion: ['Jameis Winston']
      },
      near: {
        'Joe Burrow': "Burrow's best season was 4,918 yards in 2024.",
        'Aaron Rodgers': "Rodgers' best season was 4,643 yards in 2011."
      }
    },
    {
      id: 'record_60000_career', category: 'NFL Records', difficulty: 'hard', type: 'player',
      prompt: 'Name a quarterback with at least 60,000 career passing yards.',
      scope: 'Regular-season totals through the 2025 season.',
      tiers: {
        chalk: ['Tom Brady', 'Drew Brees', 'Peyton Manning'],
        starter: ['Brett Favre', 'Aaron Rodgers'],
        pro_bowler: ['Dan Marino', 'Ben Roethlisberger', 'Matthew Stafford'],
        all_pro: ['Philip Rivers'],
        gronkillion: ['Matt Ryan']
      },
      near: {
        'Eli Manning': 'Eli finished with 57,023 passing yards.',
        'John Elway': 'Elway finished with 51,475 passing yards.'
      }
    },
    {
      id: 'record_15000_rec_yards', category: 'NFL Records', difficulty: 'hard', type: 'player',
      prompt: 'Name a player with at least 15,000 career receiving yards.',
      scope: 'Regular-season totals through the 2025 season.',
      tiers: {
        chalk: ['Jerry Rice'],
        starter: ['Larry Fitzgerald', 'Randy Moss', 'Terrell Owens'],
        all_pro: ['Tony Gonzalez'],
        gronkillion: ['Isaac Bruce']
      },
      near: {
        'Tim Brown': 'Tim Brown finished with 14,934 receiving yards.',
        'Steve Smith Sr.': 'Steve Smith Sr. finished with 14,731 receiving yards.',
        'Marvin Harrison': 'Marvin Harrison finished with 14,580 receiving yards.'
      }
    },

    /* ===== STADIUMS ===== */
    {
      id: 'stadium_sb_host', category: 'Stadiums', difficulty: 'medium', type: 'venue',
      prompt: 'Name a stadium that has hosted a Super Bowl.',
      scope: 'Super Bowls I–LX. Any official name the venue has had counts.',
      tiers: {
        chalk: ['superdome', 'hard_rock'],
        starter: ['rose_bowl', 'orange_bowl', 'levis', 'state_farm', 'raymond_james', 'sofi', 'allegiant', 'mb_stadium', 'att', 'metlife'],
        pro_bowler: ['nrg', 'us_bank', 'lucas_oil', 'ford_field', 'coliseum', 'qualcomm', 'georgia_dome'],
        all_pro: ['sun_devil', 'silverdome', 'metrodome', 'tampa_stadium', 'stanford', 'tulane'],
        hall_of_famer: ['alltel'],
        gronkillion: ['rice_stadium']
      }
    },
    {
      id: 'stadium_three_sb', category: 'Stadiums', difficulty: 'hard', type: 'venue',
      prompt: 'Name a stadium that has hosted at least three Super Bowls.',
      scope: 'Super Bowls I–LX. Any official name the venue has had counts.',
      tiers: {
        chalk: ['superdome'],
        starter: ['hard_rock'],
        pro_bowler: ['rose_bowl', 'orange_bowl'],
        all_pro: ['raymond_james', 'state_farm'],
        hall_of_famer: ['qualcomm'],
        gronkillion: ['tulane']
      },
      near: {
        levis: "Levi's Stadium has hosted two (50 and LX).",
        coliseum: 'The Coliseum has hosted two (I and VII).',
        georgia_dome: 'The Georgia Dome hosted two (XXVIII and XXXIV).',
        nrg: 'NRG Stadium has hosted two (XXXVIII and LI).',
        tampa_stadium: 'Tampa Stadium hosted two (XVIII and XXV).',
        sofi: 'SoFi Stadium has hosted one (LVI).'
      }
    },

    /* ===== NFL PLAYOFFS ===== */
    {
      id: 'playoff_qb_10_wins', category: 'NFL Playoffs', difficulty: 'medium', type: 'player',
      prompt: 'Name a quarterback with at least 10 career playoff wins as a starter.',
      scope: 'Through the 2025 postseason (Super Bowl LX).',
      tiers: {
        chalk: ['Tom Brady', 'Patrick Mahomes', 'Joe Montana'],
        starter: ['Peyton Manning', 'John Elway', 'Terry Bradshaw', 'Brett Favre', 'Aaron Rodgers'],
        pro_bowler: ['Ben Roethlisberger', 'Troy Aikman'],
        hall_of_famer: ['Roger Staubach'],
        gronkillion: ['Joe Flacco']
      },
      near: {
        'Drew Brees': 'Brees went 9–9 in the playoffs.',
        'Bart Starr': 'Starr went 9–1 in the playoffs, one win short.',
        'Kurt Warner': 'Warner went 9–4 in the playoffs.',
        'Russell Wilson': 'Wilson has nine playoff wins.',
        'Jim Kelly': 'Kelly went 9–8 in the playoffs.',
        'Eli Manning': 'Eli went 8–4 in the playoffs.'
      }
    },
    {
      id: 'playoff_sb_losing_coach', category: 'NFL Playoffs', difficulty: 'hard', type: 'player',
      prompt: 'Name a head coach who lost a Super Bowl and has never won one.',
      scope: 'Super Bowls I–LX.',
      tiers: {
        chalk: ['Kyle Shanahan', 'Marv Levy'],
        starter: ['Mike Vrabel', 'Bud Grant', 'Zac Taylor', 'Jim Harbaugh', 'Dan Reeves'],
        pro_bowler: ['John Fox', 'Ron Rivera', 'Dan Quinn', 'Lovie Smith', 'Jeff Fisher'],
        all_pro: ['Jim Caldwell', 'Ken Whisenhunt', 'Mike Martz', 'Bill Callahan'],
        hall_of_famer: ['Jim Fassel', 'Bobby Ross', 'Sam Wyche', 'George Allen'],
        gronkillion: ['Raymond Berry', 'Forrest Gregg', 'Ray Malavasi', 'Red Miller', 'John Rauch']
      },
      near: {
        'Andy Reid': 'Reid lost Super Bowl XXXIX but has since won three.',
        'Sean McVay': 'McVay lost Super Bowl LIII but won Super Bowl LVI.',
        'Nick Sirianni': 'Sirianni lost Super Bowl LVII but won Super Bowl LIX.',
        'Bill Belichick': 'Belichick won six Super Bowls as a head coach.',
        'Marty Schottenheimer': 'Schottenheimer never reached a Super Bowl.'
      }
    },
    {
      id: 'playoff_wild_card_champs', category: 'NFL Playoffs', difficulty: 'hard', type: 'team',
      prompt: 'Name a franchise that won a Super Bowl as a wild-card team.',
      scope: 'Since the 1970 merger, through Super Bowl LX.',
      tiers: {
        starter: ['New York Giants', 'Green Bay Packers', 'Tampa Bay Buccaneers'],
        pro_bowler: ['Pittsburgh Steelers'],
        all_pro: ['Baltimore Ravens'],
        hall_of_famer: ['Denver Broncos'],
        gronkillion: ['Las Vegas Raiders']
      },
      near: {
        'New England Patriots': 'All six Patriots titles came as division winners.',
        'Seattle Seahawks': 'Both Seahawks titles came as division winners.',
        'Kansas City Chiefs': 'Every Chiefs title since the merger came as a division winner.'
      }
    }
  ]
};
