var github = (function(){
  function render(target, repos){
    var i = 0, fragment = '', t = $(target)[0];

    for(i = 0; i < repos.length; i++) {
      fragment += '<li><a href="'+repos[i].html_url+'">'+repos[i].name+'</a><p>'+repos[i].description+'</p></li>';
    }
    t.innerHTML = fragment;
  }
  return {
    showRepos: function(options){
      $.ajax({
          url: "https://api.github.com/users/"+options.user+"/repos?sort=pushed&callback=?"
        , type: 'jsonp'
        , error: function (err) { $(options.target + ' li.loading').addClass('error').text("Error loading feed"); }
        , success: function(response) {
          var repos = [];
          if (!response || !response.data) { return; }
          for (var i = 0; i < response.data.length; i++) {
            if (options.skip_forks && response.data[i].fork) { continue; }
            repos.push(response.data[i]);
          }

          if (options.count) { repos.splice(options.count); }
          render(options.target, repos);
        }
      });
    }
  };
})();
