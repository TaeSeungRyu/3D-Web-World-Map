
var camera, scene, renderer, controls, stats;
//requestAnimationFrame 동작 확인
var rAF = null, cRAF = null;

//지구본 회전 속도 관련
var globe_rotation_speed = 0.001;
const MAXSPEED = 0.01; //회전 속도 최대
const MINSPEED = 0.0004; //회전 속도 최저

var base_globe = new Object();
const radius = 0.988;
const hover_scale = 1.055;
const segments = 64;
const continents = ["EU", "AN", "AS", "OC", "SA", "AF", "NA"];
const EARTH_SIZE = 20;
const MAX_POINTS = 500;


var overlay_element = null;
var main_element = null;
var isSelected = {result:false,name:null};

var splineArr = new Array();
for(var i=0; i<7; i++){
  splineArr[i] = new Array();
}
var spline_idx = Math.floor(Math.random() * 7);
var spline_progress = 0;

function start_app() {
    main_element = document.getElementById('map-canvas');
    overlay_element = document.getElementById('overlay');
    main_element.style.height = (window.innerHeight-overlay_element.offsetHeight)+"px";
    overlay_element.style.top = (window.innerHeight-overlay_element.offsetHeight)+"px";
    init();
    animate();
}

function init() {
    if (!Detector.webgl) {
        Detector.addGetWebGLMessage();
    }

    renderer = new THREE.WebGLRenderer();
    renderer.setClearColor('#1C2833',0.8);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(main_element.clientWidth, main_element.clientHeight);

    //레더링 버거울경우 반으로 줄이자 > 하지만 너무 작아서 안보일수도...
    // renderer.setSize(main_element.clientWidth/2, main_element.clientHeight/2);

    main_element.appendChild(renderer.domElement);

    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(45, main_element.clientWidth / main_element.clientHeight, 0.01, 4500);

    //카메라 시작 위치를 대한민국으로 세팅
    camera.position.x = -224;
    camera.position.y = 187;
    camera.position.z = 170;

    scene.add(new THREE.AmbientLight(0x555555)); //빛 처리 어둡게
    // scene.add(new THREE.AmbientLight(0xffffff)); //빛 처리 밝게

    const lights = [[-1,1,1],[-1,1,-1],[1,1,-1],[1,1,1]];
    lights.forEach(function(itm){  //조명 위치
        const light = new THREE.DirectionalLight(0xaaaaaa, 0.5);
        // const light = new THREE.PointLight(0xaaaaaa, 0.5);
        light.position.set(itm[0], itm[1], itm[2]).normalize();
        scene.add(light);
    });

    base_globe = new THREE.Object3D();
    base_globe.scale.set(EARTH_SIZE, EARTH_SIZE, EARTH_SIZE);
    scene.add(base_globe);
    scene.updateMatrixWorld(true);

    sea_texture = THREE.ImageUtils.loadTexture('textures/sea.jpg', THREE.UVMapping, function () {
        sea_texture.wrapS = THREE.RepeatWrapping;
        sea_texture.wrapT = THREE.RepeatWrapping;
        sea_texture.repeat.set(16, 8);
        base_globe.add(new THREE.Mesh(
          new THREE.SphereGeometry(radius, segments, segments),
            new THREE.MeshLambertMaterial({
                transparent: true,
                depthTest: true,
                depthWrite: false,
                opacity: 0.85,
                map: sea_texture,
                color: '#0082FA'
            })
          )
        );

        for (var name in country_data) {
            var geometry = new Tessalator3D(country_data[name], 0);
            var color = new THREE.Color(0xff0000);
            //지구본 국가별 색상 입히기
            color.setHSL(continents.indexOf(country_data[name].data.cont) * (1 / 7), Math.random() * 0.25 + 0.45, Math.random() / 2 + 0.25);
            var mesh = country_data[name].mesh = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({
                color: color
            }));
            mesh.name = "land";
            mesh.updateMatrixWorld(true);
            mesh.userData.country = name;
            base_globe.add(mesh);
            base_globe.updateMatrixWorld(true);

            var sum_x = 0;
            var sum_y = 0;
            var sum_z = 0;
            geometry.vertices.forEach( function (datas){
                sum_x += datas.x;
                sum_y += datas.y;
                sum_z += datas.z;
            });
            if(name == 'United States'){
                sum_x = 0.705254386270839 * geometry.vertices.length;
                sum_y = 0.6588207712606129 * geometry.vertices.length;
                sum_z = 0.2618614939262992 * geometry.vertices.length;

            }
            var addNum = 1.03;
            if(name == 'Australia' || name == 'China' || name == 'Russian Federation' || name == 'United States' || name == 'Canada' || name == 'Brazil'){
                addNum = 1.12;
            }

            sum_x = sum_x / geometry.vertices.length  * addNum;
            sum_y = sum_y / geometry.vertices.length  * addNum;
            sum_z = sum_z / geometry.vertices.length  * addNum;

            //위도, 경도 표시한 막대기길이 현재 랜덤으로 데이터 처리 중
            var value = Math.random() * 300 + 15;
            // var value = 315;

            var cubeMat = new THREE.MeshLambertMaterial({side: 2, opacity:0.6});

            //BoxGeometry - width, height, depth, widthSegments, heightSegments, depthSegments
            var geoForLine = new THREE.BoxGeometry( 0.5,0.5,1+value/8,1,1,1 );

            //나라별 위도, 경도 막대기바 SET
            var cube = new THREE.Mesh( geoForLine, cubeMat );

            cube.castShadow  = true;
            cube.position.set(sum_x, sum_y, sum_z);

            //x축과 y축이 같은값이면 정사각형 막대기로 생성
            cube.scale.x = 0.02; //막대기 넓이 x축 길이
            cube.scale.y = 0.02; //막대기 넓이 y축 길이
            cube.scale.z = 0.003; // 막대기 높이;
            cube.lookAt( new THREE.Vector3(0,0,0) );

            // 막대기 색상 처리 16진수입력
            cube.material.color.setHex(0xff0000);

            // 투명도 설정
            cube.material.transparent = true;
            cube.material.opacity = 0.8;

            // 막대기 연결점의 모양
            // cube.material.wireframe = true;
            // cube.material.wireframeLinejoin = "round";
            // cube.material.wireframeLine = 5;
            mesh.add(cube);

            //******************************임시******************************
            // 지구본에 글씨 집어넣기 -
            createTextOnGlobe(name, sum_x*20, sum_y*20, sum_z*20, color);

            // 대륙별 색 바꿔넣기용 객체
            var aFC = null;
            const AIR_LINE_COLOR = {
              "EU": {color: 0x00D8FF},
              "AN": {color: 0xFFE400},
              "AS": {color: 0xFFBB00},
              "OC": {color: 0xFAED7D},
              "SA": {color: 0x1DDB16},
              "AF": {color: 0xFFFFFF},
              "NA": {color: 0xFFD9FA}
            };
            try{
              aFC = AIR_LINE_COLOR[country_data[name].data.cont].color;
            }catch(e){
              console.log(e);
            }
            // 곡선처리 대한민국기준 항공라인 처리
            if(name != "South Korea"){
              var startV = new THREE.Vector3( -0.6511796956614361, 0.6057371400042327, 0.4979957922184134 ); //한국
              var targetV = new THREE.Vector3( sum_x, sum_y, sum_z );
              createFlightLine(startV, targetV, aFC, name, country_data[name].data.cont);
            }
            //******************************임시******************************
        }
    });

    controls = new THREE.TrackballControls(camera, renderer.domElement);
    // controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.rotateSpeed = 1;
    controls.zoomSpeed = 1.0;
    controls.noZoom = false;
    controls.noPan = true; // true -> 오른쪽 클릭 후 드래그 이벤트 막기
    controls.staticMoving = false;
    controls.minDistance = 23.0;
    controls.maxDistance = 70.0;
    controls.dynamicDampingFactor = 0.1;

    //이벤트 처리
    window.addEventListener('resize', onWindowResize, false);
    document.addEventListener('mousemove', onDocumentMouseMove, false);
    document.addEventListener('click', onGlobeClick, false);
    document.addEventListener('contextmenu', function(event){ event.preventDefault(); });
}

/* @Func > reset > 지구본 초기화(reload를 해버릴까...ㅜ) 처리 */
function reset(evt){
  if(evt != undefined && evt != null){
    evt.preventDefault();
    evt.stopPropagation();
  }

  var upObj   = document.querySelector("#upBtn i");
  var downObj = document.querySelector("#downBtn i");
  globe_rotation_speed > MAXSPEED ? upObj.className = upObj.className.replace(" offbtn", " onbtn") : downObj.className = downObj.className.replace(" offbtn", " onbtn");
  globe_rotation_speed = 0.001;

  base_globe.children.forEach(function(d){
    d.scale.set(1, 1, 1);
    if(d.material.color.r == 0.03529411764705882 && d.material.color.g == 0.19215686274509805 && d.material.color.b == 0.3333333333333333){
        var color = new THREE.Color(0xff0000);
        color.setHSL(continents.indexOf(country_data[d.userData.country].data.cont) * (1 / 7), Math.random() * 0.25 + 0.65, Math.random() / 2 + 0.25);
        d.material.color = color;
    }
  });
  overlay_element.innerHTML = '';
  isSelected = {result:false,name:null};

  //Reset!!
  controls.reset();
  scene.position.set( 0, 0, 0 );
  scene.rotation.set( 0, 0, 0 );
  camera.rotation.set( 0, 0, 0 );
  camera.position.set( -224, 187, 170 );

  animateContrller(event, 'move');
}

/*
* @Func > moveToSelectedArea > 국가 현황 클릭에 따른 강제 이동 및 선택 처리 함수
* @param {Object} Event 중복 동작 방지 처리
* @param {String} 선택한 국가 이름
*/
function moveToSelectedArea(evt, t){
  if(evt != undefined && evt != null){
    evt.preventDefault();
    evt.stopPropagation();
  }

  var target = null;
  if(t != null && t != undefined && t!= "" && typeof(t) === "string"){
    target = t;
  }else{
    console.log("The parameter value is invalid.");
    return;
  }

  var search_data = country_data[target];
  if(search_data == undefined || search_data == null){
    console.log("Non-existent country.");
    return;
  }

  var geometry = new Tessalator3D(search_data, 0);
  var sum_x = 0, sum_y = 0, sum_z = 0;

  geometry.vertices.forEach( function (datas){
      sum_x += datas.x;
      sum_y += datas.y;
      sum_z += datas.z;
  });

  sum_x = sum_x / geometry.vertices.length;
  sum_y = sum_y / geometry.vertices.length;
  sum_z = sum_z / geometry.vertices.length;

  camera.position.x = (sum_x) * 100;
  camera.position.y = (sum_y) * 100;
  camera.position.z = (sum_z) * 100;

  stopAnimateAndSelectNational(); //애니메이션 동작 멈추기

  base_globe.children.forEach(function(d){
    d.scale.set(1, 1, 1);
    if(d.material.color.r == 0.03529411764705882 && d.material.color.g == 0.19215686274509805 && d.material.color.b == 0.3333333333333333){
        var color = new THREE.Color(0xff0000);
        color.setHSL(continents.indexOf(country_data[d.userData.country].data.cont) * (1 / 7), Math.random() * 0.25 + 0.65, Math.random() / 2 + 0.25);
        d.material.color = color;
    }

    if(d.userData.country == target){
      overlay_element.innerHTML = d.userData.country + ', 여기에 표출 or 클릭이벤트로 그래프 보여주기';
      d.scale.set(hover_scale, hover_scale, hover_scale);
      d.material.color.set('#093155');
      isSelected = {'result':true,'name':d.userData.country};
    }
  });
}

//클릭 이벤트 처리
function onGlobeClick(event){
    event.preventDefault();
    event.stopPropagation();
    commonSearch(event);
}

function commonSearch(event){

    var mouseX = (event.clientX / main_element.clientWidth) * 2 - 1;
    var mouseY = -(event.clientY / main_element.clientHeight) * 2 + 1;
    var vector = new THREE.Vector3(mouseX, mouseY, -1);
    vector.unproject(camera);
    base_globe.children.map(function(element){  //초기화
        element.scale.set(1, 1, 1);
        if(element.material.color.r == 0.03529411764705882 && element.material.color.g == 0.19215686274509805 && element.material.color.b == 0.3333333333333333){

            var color = new THREE.Color(0xff0000);
            color.setHSL(continents.indexOf(country_data[element.userData.country].data.cont) * (1 / 7), Math.random() * 0.25 + 0.65, Math.random() / 2 + 0.25);
            element.material.color = color;
        }
        return element;
    });

    var raycaster = new THREE.Raycaster(camera.position, vector.sub(camera.position).normalize());
    var intersects = raycaster.intersectObject(base_globe, true);

    if (intersects.length > 0) {
        if (intersects[0].point !== null) {
            if (intersects[0].object.name === "land") {
                overlay_element.innerHTML = intersects[0].object.userData.country + ', 여기에 표출 or 클릭이벤트로 그래프 보여주기';
                intersects[0].object.scale.set(hover_scale, hover_scale, hover_scale);
                intersects[0].object.material.color.set('#093155');
                isSelected = {'result':true,'name':intersects[0].object.userData.country};
            } else {
                overlay_element.innerHTML = '';
                isSelected = {result:false,name:null};
            }
        } else {
            overlay_element.innerHTML = '';
            isSelected = {result:false,name:null};
        }
    } else {
        overlay_element.innerHTML = '';
        isSelected = {result:false,name:null};
    }
}

/* @Func > onWindowResize > Window.resize event */
function onWindowResize() {
  main_element.style.height = (window.innerHeight-overlay_element.offsetHeight)+"px";
  overlay_element.style.top = window.innerHeight-overlay_element.offsetHeight+"px";
  camera.aspect = main_element.clientWidth / main_element.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(main_element.clientWidth, main_element.clientHeight);
}

function onDocumentMouseMove(event) {

}

/*
* @Func > animate > 기본 default로 동작시킬 재귀함수 animate -autoRotation 함수 포함
* requestAnimationFrame에 의해 자기자신을 계속 호출 하여 드래그나 줌등 여러가지 이벤트를
* 프레임단위로 부드럽게 처리해줌 / setInterval보다 효율적
*/
function animate(){
  autoRotation(); //자동 회전
  controls.update();
  renderer.render(scene, camera);
  // 에어라인 애니메이션용 진행률 처리
  if(spline_progress > 55){//51이 Max이지만 자연스럽게 처리하기 위해 좀 더 늘림...
    spline_progress = 0;
    spline_idx++;
    spline_idx = spline_idx>6 ? 0 : spline_idx;
  }else{
    spline_progress++;
  }
  splineAnimate(spline_progress, spline_idx);
  rAF = requestAnimationFrame(animate);
}

/*
* @Func > nonRotatingAnimate > autoRotation 함수가 없어서 회전하지 않는 재귀 animate
*/
function nonRotatingAnimate(time){ //자동 회전이 없음
  controls.update();
  renderer.render(scene, camera);
  cRAF = requestAnimationFrame(nonRotatingAnimate);
}

/* @Func > autoRotation > 공간값의 y축을 전역변수 globe_rotation_speed값만큼 추가하여 회전 */
function autoRotation(){
  //camera를 rotation 시키면 드래그 이벤트시 camera가 돌리는 위치만 고정됨.
  //scene로 공간을 돌려서 처리
  scene.rotation.y += globe_rotation_speed;
}

/* @Func > autoRotation > 자동 회전 잠시 멈추고 공간 y축 0으로 초기화 */
function stopAnimateAndSelectNational(){
  if(cRAF == null || cRAF == undefined && (rAF != null && rAF != undefined)){
    cancelAnimationFrame(rAF); //clearInterval 효과
    rAF = null;
    nonRotatingAnimate();
  }
  scene.rotation.y = 0;
  controls.update();
  renderer.render(scene, camera);

  //애니메이션 제어 버튼 색상
  var playObj = document.querySelector("#playBtn i");
  var stopObj = document.querySelector("#stopBtn i");
  stopObj.className = stopObj.className.replace(" onbtn", " offbtn");
  playObj.className = playObj.className.replace(" offbtn", " onbtn");
}

/*
* @Func > animateContrller > 애니메이션 동작 제어 함수(시작, 멈춤, 회전속도 증가, 감소)
* @param {Object} Event 중복 동작 방지 처리
* @param {String} 처리할 동작 이름 HTML onclick Event
*/
function animateContrller(evt, param){
  if(evt != undefined && evt != null){
      evt.preventDefault();
      evt.stopPropagation();
  }

  const VALUE = 0.0003;

  var playObj = document.querySelector("#playBtn i");
  var stopObj = document.querySelector("#stopBtn i");
  var upObj   = document.querySelector("#upBtn i");
  var downObj = document.querySelector("#downBtn i");

  if(param == "move"){ // 회전 시키기
    if((rAF == null || rAF == undefined) && (cRAF != null || cRAF != undefined)){
      cancelAnimationFrame(cRAF); //clearInterval 효과
      cRAF = null;
      animate();
      playObj.className = playObj.className.replace(" onbtn", " offbtn");
      stopObj.className = stopObj.className.replace(" offbtn", " onbtn");
    }
  }else if(param == "stop"){ // 회전 멈춤
    if((cRAF == null || cRAF == undefined) && (rAF != null || rAF != undefined)){
      cancelAnimationFrame(rAF); //clearInterval 효과
      rAF = null;
      nonRotatingAnimate();
      stopObj.className = stopObj.className.replace(" onbtn", " offbtn");
      playObj.className = playObj.className.replace(" offbtn", " onbtn");
    }
  }else if(param == "up"){ //회전 속도 증가
    if(globe_rotation_speed > MAXSPEED){
      upObj.className = upObj.className.replace(" onbtn", " offbtn");
    }else{
      globe_rotation_speed += VALUE;
      downObj.className = downObj.className.replace(" offbtn", " onbtn");
    }
  }else if(param == "down"){ //회전 속도 감소
    if(globe_rotation_speed < MINSPEED){
      downObj.className = downObj.className.replace(" onbtn", " offbtn");
    }else{
      globe_rotation_speed -= VALUE;
      upObj.className = upObj.className.replace(" offbtn", " onbtn");
    }
  }else{ //error
    console.log("An incorrect command");
    return;
  }
}

function clickZoom(evt,type){
    evt.preventDefault();
    evt.stopPropagation();
    if(type=='detail'){
        controls.mousewheelExport(getBrowserType(50));
    } else{
        controls.mousewheelExport(getBrowserType(-50));
    }
}

function getBrowserType(num){
    return {wheelDelta:num,detail:false};
}

function getRandomColor() {  //테스트용
    var letters = '0123456789ABCDEF';
    var color = '#';
    for (var i = 0; i < 6; i++) {
      color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}

/*
* @Func > createTextOnGlobe > 지구본 위에 글씨 집어 넣기
* @param {String} 생성하고자 하는 글자 입력 > 한국에서 입력나라로 곡선 만듬
* @param {Number} 글자 위치 x축
* @param {Number} 글자 위치 y축
* @param {Number} 글자 위치 z축
* @param {Number} 텍스트 컬러 16진수 > (사용 안함)
* @return void;
*/
function createTextOnGlobe(inputText, ix, iy, iz, tc){
   // e:/project/three.js-dev/three.js-dev/examples/webgl_geometry_text_shapes.html 참고

   var loader = new THREE.FontLoader();
   //사용할 폰트를 json형식으로 로드한다.

   loader.load('fonts/helvetiker_regular.typeface.json', function(font){ //영문만 있는 폰트
   // loader.load('fonts/SpoqaHanSans-Regular_Regular.json', function(font){ //한글만 있는 폰트
     const TEXTSIZE = 0.4; //글씨 크기
     const TEXTCOLOR = 0xFFFFFF; //글씨 색상 default color white

     var x = 0, y = 0, z = 0; //좌표 처리
     if(ix != null && ix != undefined){
       x = ix;
     }
     if(iy != null && iy != undefined){
       y = iy;
     }
     if(iz != null && iz != undefined){
       z = iz;
     }

     var matDark = new THREE.LineBasicMaterial({
       color: TEXTCOLOR,
       side: THREE.DoubleSide
     });

     var matLite = new THREE.MeshBasicMaterial({
       color: TEXTCOLOR,
       transparent: true,
       opacity: 1,
       side: THREE.DoubleSide
     });

     var message = "";
     if(inputText != null && inputText != undefined && inputText != ""){
       message = inputText; //메시지 입력
     }
     var shapes = font.generateShapes( message, TEXTSIZE );
     var geometry = new THREE.ShapeBufferGeometry( shapes );
     geometry.computeBoundingBox();
     var xMid = - 0.5 * ( geometry.boundingBox.max.x - geometry.boundingBox.min.x );
     geometry.translate( xMid, 0, 0 );

     var text = new THREE.Mesh( geometry, matLite );
     text.scale.x = -1; //기준이 지구본 정가운데라서 처리 안해주면 텍스트가 반전되어 나옴.
     text.position.set( x*1.04, y*1.04, z*1.04 ); //글자 자리 위치시키기
     text.lookAt( new THREE.Vector3( 0, 0, 0 ) ); //lookAt 처리를 해줘야 지구본 중심(0,0,0)을 향해 글자가 정렬 됨.
     scene.add( text );
   });
}

/*
* @Func > vector3toLatLon > Vector3값으로 위도, 경도를 구해주는 함수
* @param {Object} THREE.Vector3 값
* @retrun {Object} {lat, lng}
*/
function vector3toLatLon( vector3 )
{
    vector3.normalize();
    //longitude = angle of the vector around the Y axis
    //-( ) : negate to flip the longitude (3d space specific )
    //- PI / 2 to face the Z axis
    var lng = -( Math.atan2( -vector3.z, -vector3.x ) ) - Math.PI / 2;

    //to bind between -PI / PI
    if( lng < - Math.PI )lng += Math.PI * 2;

    //latitude : angle between the vector & the vector projected on the XZ plane on a unit sphere

    //project on the XZ plane
    var p = new THREE.Vector3( vector3.x, 0, vector3.z );
    //project on the unit sphere
    p.normalize();

    //commpute the angle ( both vectors are normalized, no division by the sum of lengths )
    var lat = Math.acos( p.dot( vector3 ) );

    //invert if Y is negative to ensure teh latitude is comprised between -PI/2 & PI / 2
    if( vector3.y < 0 ) lat *= -1;

    return [ lat, lng ];
}

function clamp(num, min, max) {
  return num <= min ? min : (num >= max ? max : num);
}

/*
* @Func > coordinateToPosition > 위도, 경도 값을 Vector3값으로 변경하는 함수
* @param {Number} lat
* @param {Number} lng
* @param {Number} 굴곡률?
*/
function coordinateToPosition(lat, lng, rad) {
  var radius = 1;
  var out = new THREE.Vector3();
  //flips the Y axis
  lat = Math.PI / 2 - lat;

  if(rad != null && rad != undefined && rad != 0){
    radius = rad;
  }

  var x = Math.sin( lat ) * Math.sin( lng ) * radius;
  var y = Math.cos( lat ) * radius;
  var z = Math.sin( lat ) * Math.cos( lng ) * radius;

  //distribute to sphere
  out.set( x, y, z );
  return out;
}

/*
* @Func > getSplineFromCoords > 시작점, 중간1, 중간2, 끝점을 Vector3로 표현하는 함수
* @param {Object} 4사이즈 배열 입력 [시작점 위,경도,도착점 위,경도];
* @return {Object} THREE.CubicBezierCurve3;
*/
function getSplineFromCoords(coords) {
  const CURVE_MIN_ALTITUDE = 5;
  const CURVE_MAX_ALTITUDE = 20;

  const startLat = coords[0];
  const startLng = coords[1];
  const endLat = coords[2];
  const endLng = coords[3];

  // start and end points
  const start = coordinateToPosition(startLat, startLng, EARTH_SIZE);
  const end = coordinateToPosition(endLat, endLng, EARTH_SIZE);

  // altitude
  const altitude = clamp(start.distanceTo(end) * .75, CURVE_MIN_ALTITUDE, CURVE_MAX_ALTITUDE);

  // 2 control points
  const interpolate = d3.geoInterpolate([startLng, startLat], [endLng, endLat]);
  const midCoord1 = interpolate(0.25);
  const midCoord2 = interpolate(0.75);
  const mid1 = coordinateToPosition(midCoord1[1], midCoord1[0], 25 + altitude);
  const mid2 = coordinateToPosition(midCoord2[1], midCoord2[0], 25 + altitude);

  //CubicBezierCurve3 > 시작지점, 중간1, 중간2, 도착지점으로 구성
  return new THREE.CubicBezierCurve3(start, mid1, mid2, end);
}

/*
* @Func > createFlightLine > 기준부터 타겟까지 곡선만들고 scene 추가 처리 함수
* @param {Object} 기준이 될 국가의 Vector3 입력 시작점
* @param {Object} 타겟이 될 국가의 Vector3 입력 도착점
* @param {Number} 생성할 색상 16진수 입력 ex) 0xFFFFFF;
* @return void;
*/
function createFlightLine(sv, tv, lc, name, cont){
  var startPoint = null;
  var endPoint = null;
  var lineColor = null;

  if(sv != null && sv != undefined && tv != null && tv != undefined){
    startPoint = sv;
    endPoint = tv;
  }else{
    console.log("Incorrect Vector Information");
    return;
  }

  lineColor = lc!=null && lc!=undefined ? lc : 0xFFA500;

  var spArr = vector3toLatLon(startPoint); //시작지 위도 경도 구하기
  var epArr = vector3toLatLon(endPoint); //도착지 위도 경도 구하기
  var targetArr = new Array();
  if(spArr.length + epArr.length == 4){
    for(i=0; i<4; i++){

  	   if(i<2)
         targetArr[i] = spArr[i];
       else
         targetArr[i] = epArr[i-2];
    }
  }else{
    console.log("Invalid Vector Size");
    return;
  }

  //curve곡선 이어주기
  var curve = getSplineFromCoords(targetArr);

  // 애니메이션 라인 처리를 위해 기존 Geometry에서 BufferGeometry로 변경
  /***************************** before *****************************/
  // var curveGeometry = new THREE.Geometry();
  // 시작~ 중간1~ 중간2~ 도착 까지 50개의 지점을 자동으로 생성하여 매끄러운 곡선을 생성한다.
  // curveGeometry.vertices = curve.getPoints( 50 );


  /***************************** after *****************************/
  var lineDatas = curve.getPoints( 50 );
  var curveGeometry = new THREE.BufferGeometry();
  // create a simple square shape. We duplicate the top left and bottom right
  // vertices because each vertex needs to appear once per triangle.
  var d = new Array();
  lineDatas.forEach(function(data){
    d.push(data.x); d.push(data.y); d.push(data.z);
  });

  //BufferAttribute Array 타입이 들어가야 하며, 벡터값 처리므로 3사이즈로 처리한다.
  curveGeometry.addAttribute( 'position', new THREE.BufferAttribute( new Float32Array( d ), 3 ) ); //벡터값 처리이므로 3
  curveGeometry.setDrawRange(0, 0); // setDrawRange 메소드를 통해 그릴 선의 진행률을 처리 할 수 있다.

  // 생성할 곡선 속성 변경 - 색상, 투명도정도만... 두께 형태 등의 조절은 불가능
  var curveMaterial = new THREE.LineBasicMaterial({
    color: lineColor, linewidth: 5, linecap: 'round', linejoin:  'round',  transparent: true, opacity: 0.6
  });


  var curveLine = new THREE.Line( curveGeometry, curveMaterial );
  curveLine.userData.country = name;
  curveLine.userData.cont = cont;
  // 생성한 곡선 추가
  scene.add(curveLine);

  // 라인 애니메이션 처리용 배열 처리
  switch (cont) {
    case "EU": splineArr[0].push(curveLine); break;
    case "AN": splineArr[1].push(curveLine); break;
    case "AS": splineArr[2].push(curveLine); break;
    case "OC": splineArr[3].push(curveLine); break;
    case "SA": splineArr[4].push(curveLine); break;
    case "AF": splineArr[5].push(curveLine); break;
    case "NA": splineArr[6].push(curveLine); break;
  }
}

/*
* @Func > splineAnimate > 에어라인 그림 그리기 애니메이션 동작용
* @param {Number} 라인을 그릴 범위
* @param {Number} 라인을 처리할 대륙
* @return NULL;
*/
function splineAnimate(range, idx){
  if(splineArr[idx].length>0){
    // 모든 라인 동시에 처리
    // for(i=0; i<splineArr.length; i++){
    //   for(j=0; j<splineArr[i].length; j++){
    //       splineArr[i][j].geometry.setDrawRange( 0, line );
    //   }
    // }

    // 선택된 대륙만 그리기
    for(i=0; i<splineArr[idx].length; i++){
      splineArr[idx][i].geometry.setDrawRange( 0, range );
    }

    // 선택된 대륙을 제외하고 범위 0으로 초기화
    for(i=0; i<splineArr.length; i++){
      if(i == idx) //선택된 대륙은 넘어간다.
        continue;

      for(j=0; j<splineArr[i].length; j++){
          splineArr[i][j].geometry.setDrawRange( 0, 0 ); // 라인 초기화
      }
    }

  }else{
    console.log("No data in flight path array.");
    return;
  }
}
